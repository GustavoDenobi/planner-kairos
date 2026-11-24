import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AssignmentWithDetails, GroupListItem } from '@/domain/ensemble';
import type {
  PieceCategory,
  PieceListItem,
  PieceListSort,
  PieceTheme,
  RepertoirePieceMembership,
} from '@/domain/repertoire';
import { DEFAULT_PIECE_LIST_SORT } from '@/domain/repertoire';
import { useEnsemble, useRepertoire } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { Modal } from '@/ui/components/Modal';
import { OrgListRowsSkeleton } from '@/ui/components/skeletons/page-list-skeletons';
import { CategoryHuePicker } from '@/ui/components/CategoryHuePicker';
import { IconChevronLeft, IconPlus } from '@/ui/components/icons';
import {
  RepertoireAdminMenu,
  type RepertoireAdminSection,
} from '@/ui/features/repertoire/RepertoireAdminMenu';
import { RepertoireCategoriesSection } from '@/ui/features/repertoire/RepertoireCategoriesSection';
import {
  RepertoirePiecesSection,
} from '@/ui/features/repertoire/RepertoirePiecesSection';
import { RepertoireReportsSection } from '@/ui/features/repertoire/RepertoireReportsSection';
import { RepertoireThemesSection } from '@/ui/features/repertoire/RepertoireThemesSection';
import {
  loadRepertoireMemberFilters,
  saveRepertoireMemberFilters,
} from '@/ui/features/repertoire/repertoire-filters-storage';
import { resolveRepertoireSearchFilters } from '@/domain/repertoire/repertoire-filters';
import { isPieceListSort, repertoireErrorMessage } from '@/ui/features/repertoire/repertoire-labels';
import { isPageStepState, PAGE_STEP_STATE } from '@/ui/navigation/page-step';
import { PieceAliasesField } from '@/ui/features/repertoire/PieceAliasesField';
import {
  encodeRepertoireCategoryParam,
  encodeRepertoireGroupParam,
  parseRepertoireSection,
  readRepertoireCategoryParam,
  readRepertoireGroupParam,
  REPERTOIRE_CATEGORY_QUERY,
  REPERTOIRE_GROUP_QUERY,
  REPERTOIRE_SEARCH_QUERY,
  REPERTOIRE_SECTION_QUERY,
  REPERTOIRE_SORT_QUERY,
  REPERTOIRE_THEME_QUERY,
  repertoireSectionQueryValue,
} from '@/ui/features/repertoire/repertoire-routes';
import {
  orgListPageHeightClass,
  orgPageContentClass,
  scrollContentEndPaddingClass,
} from '@/ui/layouts/OrgListPageLayout';
import {
  DEFAULT_CATEGORY_HUE,
  formatCategoryHue,
  parseCategoryHue,
} from '@/ui/features/repertoire/category-color';

const SEARCH_DEBOUNCE_MS = 300;

type TaxonomyModalState =
  | { kind: 'category'; id: string | null; name: string; hue: number }
  | { kind: 'theme'; id: string | null; name: string };

export function RepertoirePage() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const repertoire = useRepertoire();
  const ensemble = useEnsemble();
  const { userId } = useAuth();
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';

  const adminSection: RepertoireAdminSection | 'menu' = isAdmin
    ? (parseRepertoireSection(searchParams.get('secao')) ?? 'menu')
    : 'pieces';

  /**
   * Avança uma etapa dentro da página (`push`: nova entrada no histórico) ou só ajusta
   * filtros da etapa atual (substitui a entrada) — assim "voltar" volta à etapa anterior.
   */
  function updateParams(
    patch: Record<string, string | null>,
    { push = false }: { push?: boolean } = {},
  ) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(
      next,
      push ? { state: PAGE_STEP_STATE } : { replace: true, state: location.state },
    );
  }

  /** Volta à etapa anterior da página; sem histórico de etapas (link direto), vai para `fallback`. */
  function stepBack(fallback: URLSearchParams) {
    if (isPageStepState(location.state)) {
      navigate(-1);
      return;
    }
    setSearchParams(fallback, { replace: true });
  }

  function openAdminSection(section: RepertoireAdminSection) {
    setSearchParams(
      { [REPERTOIRE_SECTION_QUERY]: repertoireSectionQueryValue(section) },
      { state: PAGE_STEP_STATE },
    );
  }

  function goBackInAdminSection() {
    stepBack(new URLSearchParams());
  }

  const urlGroupId = readRepertoireGroupParam(searchParams);
  const urlCategoryId = readRepertoireCategoryParam(searchParams);
  const searchQuery = searchParams.get(REPERTOIRE_SEARCH_QUERY) ?? '';
  const themeFilter = searchParams.get(REPERTOIRE_THEME_QUERY) ?? '';
  const sortParam = searchParams.get(REPERTOIRE_SORT_QUERY);
  const sortFilter: PieceListSort =
    sortParam && isPieceListSort(sortParam) ? sortParam : DEFAULT_PIECE_LIST_SORT;

  const [pieces, setPieces] = useState<PieceListItem[]>([]);
  const [categories, setCategories] = useState<PieceCategory[]>([]);
  const [themes, setThemes] = useState<PieceTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(true);
  const [memberFiltersReady, setMemberFiltersReady] = useState(isAdmin);
  const [pickerContextReady, setPickerContextReady] = useState(false);

  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [pieceMemberships, setPieceMemberships] = useState<RepertoirePieceMembership[]>([]);
  // Grupo implícito do membro (quando ele só tem um) e última categoria salva: valem
  // enquanto a URL ainda não traz a escolha.
  const [defaultMemberGroupId, setDefaultMemberGroupId] = useState('');
  const [savedMemberCategoryId, setSavedMemberCategoryId] = useState('');

  const groupFilter = urlGroupId ?? '';
  const categoryFilter = urlCategoryId ?? '';
  const memberGroupId = urlGroupId ?? defaultMemberGroupId;
  const memberCategoryId = urlCategoryId ?? savedMemberCategoryId;
  // Sem categoria escolhida na URL, a etapa atual é o seletor de grupo/categoria.
  const showCategoryPicker = urlCategoryId === null;

  const [searchInput, setSearchInput] = useState(searchQuery);
  const lastWrittenSearchRef = useRef(searchQuery);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [taxonomyModal, setTaxonomyModal] = useState<TaxonomyModalState | null>(null);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [isSavingTaxonomy, setIsSavingTaxonomy] = useState(false);
  const [isReorderingCategories, setIsReorderingCategories] = useState(false);
  const [categoryReorderError, setCategoryReorderError] = useState<string | null>(null);

  const showPiecesView = isAdmin ? adminSection === 'pieces' : true;

  const isPageLoading =
    isTaxonomyLoading ||
    (showPiecesView && isLoading) ||
    (!isAdmin && !memberFiltersReady) ||
    !pickerContextReady;
  useLoadingBar('repertoire', isPageLoading);

  const adminSectionTitles: Record<RepertoireAdminSection, string> = {
    pieces: 'Obras',
    categories: 'Categorias',
    themes: 'Temas',
    reports: 'Relatórios',
  };
  const pageTitle =
    isAdmin && adminSection !== 'menu' ? adminSectionTitles[adminSection] : 'Repertório';

  const loadTaxonomy = useCallback(async () => {
    if (!org) {
      setIsTaxonomyLoading(false);
      return;
    }

    setIsTaxonomyLoading(true);

    const [categoriesResult, themesResult] = await Promise.all([
      repertoire.listPieceCategories(org.id),
      repertoire.listPieceThemes(org.id),
    ]);

    if (categoriesResult.ok) {
      setCategories(categoriesResult.value);
      if (!categoryId && categoriesResult.value[0]) {
        setCategoryId(categoriesResult.value[0].id);
      }
    }
    if (themesResult.ok) {
      setThemes(themesResult.value);
    }

    setIsTaxonomyLoading(false);
  }, [org, repertoire, categoryId]);

  const pickerGroups = useMemo(() => {
    if (isAdmin) {
      return groups;
    }

    const assignedGroupIds = new Set(assignments.map((assignment) => assignment.groupId));
    return groups.filter((group) => assignedGroupIds.has(group.id));
  }, [groups, assignments, isAdmin]);

  const userAssignmentGroupCount = useMemo(
    () => new Set(assignments.map((assignment) => assignment.groupId)).size,
    [assignments],
  );

  const showGroupPicker =
    isAdmin || (pickerGroups.length > 1 && userAssignmentGroupCount > 1);

  const implicitGroupId =
    showGroupPicker ? '' : (isAdmin ? groupFilter : memberGroupId);

  const loadPickerContext = useCallback(async () => {
    if (!org) {
      setPickerContextReady(true);
      return;
    }

    setPickerContextReady(false);

    const [groupsResult, membershipsResult] = await Promise.all([
      ensemble.listGroups(org.id),
      repertoire.listPieceGroupMemberships(org.id),
    ]);

    const nextGroups = groupsResult.ok
      ? groupsResult.value.filter((group) => !group.archivedAt)
      : [];
    setGroups(nextGroups);
    setPieceMemberships(membershipsResult.ok ? membershipsResult.value : []);

    let nextAssignments: AssignmentWithDetails[] = [];
    if (!isAdmin && userId) {
      const musicianResult = await ensemble.getMyMusician(org.id, userId);
      if (musicianResult.ok) {
        const assignmentsResult = await ensemble.listAssignmentsForMusician(
          org.id,
          musicianResult.value.id,
        );
        nextAssignments = assignmentsResult.ok ? assignmentsResult.value : [];
      }
    }
    setAssignments(nextAssignments);

    const assignedGroupIds = [...new Set(nextAssignments.map((assignment) => assignment.groupId))];
    const availableGroups = isAdmin
      ? nextGroups
      : nextGroups.filter((group) => assignedGroupIds.includes(group.id));
    const assignmentGroupCount = assignedGroupIds.length;

    const initialGroupId =
      isAdmin || (availableGroups.length > 1 && assignmentGroupCount > 1)
        ? ''
        : (availableGroups[0]?.id ?? '');

    if (!isAdmin) {
      setDefaultMemberGroupId(initialGroupId);
    }

    setPickerContextReady(true);
  }, [org, userId, isAdmin, ensemble, repertoire]);

  const loadMemberFilters = useCallback(async () => {
    if (!org || !userId || isAdmin) {
      setMemberFiltersReady(true);
      return;
    }

    const categoriesResult = await repertoire.listPieceCategories(org.id);
    const categoryList = categoriesResult.ok ? categoriesResult.value : [];

    const saved = loadRepertoireMemberFilters(org.id, userId);
    const resolvedCategoryId =
      saved?.categoryId && categoryList.some((category) => category.id === saved.categoryId)
        ? saved.categoryId
        : '';

    setSavedMemberCategoryId(resolvedCategoryId);
    setMemberFiltersReady(true);
  }, [org, userId, isAdmin, repertoire]);

  const loadPieces = useCallback(async () => {
    if (!org || !showPiecesView) {
      setIsLoading(false);
      return;
    }

    if (!isAdmin && !memberFiltersReady) {
      return;
    }

    setIsLoading(true);

    const activeGroupId = isAdmin ? groupFilter : memberGroupId;
    const activeCategoryId = isAdmin ? categoryFilter : memberCategoryId;
    const resolvedFilters = resolveRepertoireSearchFilters(activeGroupId, activeCategoryId);

    const searchOptions = {
      query: searchQuery || undefined,
      categoryId: resolvedFilters.categoryId,
      themeIds: themeFilter ? [themeFilter] : undefined,
      groupId: resolvedFilters.groupId,
      unlinkedOnly: resolvedFilters.unlinkedOnly || undefined,
      sort: sortFilter,
    };

    const piecesResult = await repertoire.searchPieces(org.id, searchOptions);

    if (piecesResult.ok) {
      setPieces(piecesResult.value);
    }
    setIsLoading(false);
  }, [
    org,
    showPiecesView,
    isAdmin,
    memberFiltersReady,
    searchQuery,
    categoryFilter,
    themeFilter,
    memberCategoryId,
    memberGroupId,
    groupFilter,
    sortFilter,
    repertoire,
  ]);

  // A busca vive na URL (com debounce) para que voltar reabra a mesma listagem.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === searchQuery) {
      return;
    }
    const timer = window.setTimeout(() => {
      lastWrittenSearchRef.current = trimmed;
      updateParams({ [REPERTOIRE_SEARCH_QUERY]: trimmed });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // updateParams muda a cada render; o debounce só depende do texto digitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, searchQuery]);

  // Voltar/avançar no histórico troca a busca da URL: reflete no campo.
  useEffect(() => {
    if (searchQuery === lastWrittenSearchRef.current) {
      return;
    }
    lastWrittenSearchRef.current = searchQuery;
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    loadTaxonomy();
    loadPickerContext();
    loadMemberFilters();
  }, [loadTaxonomy, loadPickerContext, loadMemberFilters]);

  useEffect(() => {
    loadPieces();
  }, [loadPieces]);

  useEffect(() => {
    if (!org || !userId || isAdmin) {
      return;
    }
    saveRepertoireMemberFilters(org.id, userId, {
      categoryId: memberCategoryId,
      groupId: memberGroupId,
    });
  }, [org, userId, isAdmin, memberCategoryId, memberGroupId]);

  if (!org) {
    return null;
  }

  function handleCategoryPickerSelect(
    selection: { groupId: string; categoryId: string },
    { auto }: { auto: boolean },
  ) {
    // Escolha automática (opção única) substitui a etapa: voltar não cai de novo nela.
    updateParams(
      {
        [REPERTOIRE_GROUP_QUERY]: encodeRepertoireGroupParam(selection.groupId),
        [REPERTOIRE_CATEGORY_QUERY]: encodeRepertoireCategoryParam(selection.categoryId),
      },
      { push: !auto },
    );
  }

  function handlePickerSelectGroup(groupId: string) {
    updateParams(
      { [REPERTOIRE_GROUP_QUERY]: encodeRepertoireGroupParam(groupId) },
      { push: true },
    );
  }

  function handlePickerBackToGroups() {
    const fallback = new URLSearchParams(searchParams);
    fallback.delete(REPERTOIRE_GROUP_QUERY);
    fallback.delete(REPERTOIRE_CATEGORY_QUERY);
    stepBack(fallback);
  }

  function handleOpenCategoryPicker() {
    // Reabre o seletor do início (grupo, se houver essa etapa) como uma nova etapa.
    updateParams(
      {
        [REPERTOIRE_CATEGORY_QUERY]: null,
        ...(showGroupPicker ? { [REPERTOIRE_GROUP_QUERY]: null } : {}),
      },
      { push: true },
    );
  }

  async function handleCreatePiece(event: React.FormEvent) {
    event.preventDefault();
    if (!org) {
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    const result = await repertoire.catalogPiece(org.id, {
      title,
      categoryId,
      composer: composer || null,
      aliases,
      themeIds: selectedThemeIds,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setFormError(repertoireErrorMessage(result.error));
      return;
    }

    setCreateOpen(false);
    setTitle('');
    setComposer('');
    setAliases([]);
    setSelectedThemeIds([]);
    navigate(`/${orgSlug}/repertorio/${result.value.id}`);
  }

  function openCreateCategoryModal() {
    setTaxonomyModal({ kind: 'category', id: null, name: '', hue: DEFAULT_CATEGORY_HUE });
    setTaxonomyError(null);
  }

  function openEditCategoryModal(category: PieceCategory) {
    setTaxonomyModal({
      kind: 'category',
      id: category.id,
      name: category.name,
      hue: parseCategoryHue(category.color, category.slug),
    });
    setTaxonomyError(null);
  }

  function openCreateThemeModal() {
    setTaxonomyModal({ kind: 'theme', id: null, name: '' });
    setTaxonomyError(null);
  }

  function openEditThemeModal(theme: PieceTheme) {
    setTaxonomyModal({ kind: 'theme', id: theme.id, name: theme.name });
    setTaxonomyError(null);
  }

  async function handleSaveTaxonomy(event: React.FormEvent) {
    event.preventDefault();
    if (!taxonomyModal || !org) {
      return;
    }

    setTaxonomyError(null);
    setIsSavingTaxonomy(true);

    const result =
      taxonomyModal.kind === 'category'
        ? taxonomyModal.id
          ? await repertoire.updatePieceCategory(org.id, taxonomyModal.id, {
              name: taxonomyModal.name,
              color: formatCategoryHue(taxonomyModal.hue),
            })
          : await repertoire.createPieceCategory(org.id, {
              name: taxonomyModal.name,
              color: formatCategoryHue(taxonomyModal.hue),
            })
        : taxonomyModal.id
          ? await repertoire.updatePieceTheme(org.id, taxonomyModal.id, {
              name: taxonomyModal.name,
            })
          : await repertoire.createPieceTheme(org.id, { name: taxonomyModal.name });

    setIsSavingTaxonomy(false);

    if (!result.ok) {
      setTaxonomyError(repertoireErrorMessage(result.error));
      return;
    }

    setTaxonomyModal(null);
    await loadTaxonomy();
  }

  async function handleDeleteTaxonomy() {
    if (!taxonomyModal?.id || !org) {
      return;
    }

    setTaxonomyError(null);
    setIsSavingTaxonomy(true);

    const result =
      taxonomyModal.kind === 'category'
        ? await repertoire.deletePieceCategory(org.id, taxonomyModal.id)
        : await repertoire.deletePieceTheme(org.id, taxonomyModal.id);

    setIsSavingTaxonomy(false);

    if (!result.ok) {
      setTaxonomyError(repertoireErrorMessage(result.error));
      return;
    }

    setTaxonomyModal(null);
    await loadTaxonomy();
    await loadPieces();
  }

  async function handleReorderCategories(reordered: PieceCategory[]) {
    if (!org) {
      return;
    }

    const previous = categories;
    setCategories(reordered);
    setCategoryReorderError(null);
    setIsReorderingCategories(true);

    const result = await repertoire.reorderPieceCategories(
      org.id,
      reordered.map((category) => category.id),
    );

    setIsReorderingCategories(false);

    if (!result.ok) {
      setCategories(previous);
      setCategoryReorderError(repertoireErrorMessage(result.error));
    }
  }

  const useFixedListLayout =
    showPiecesView ||
    (isAdmin &&
      (adminSection === 'categories' || adminSection === 'themes' || adminSection === 'reports'));

  return (
    <div
      className={
        useFixedListLayout
          ? `flex flex-col ${orgPageContentClass} ${orgListPageHeightClass}`
          : `${orgPageContentClass} space-y-6`
      }
    >
      <div
        className={
          useFixedListLayout
            ? 'shrink-0 pb-6'
            : undefined
        }
      >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          {isAdmin && adminSection !== 'menu' && (
            <button
              type="button"
              onClick={goBackInAdminSection}
              className="flex shrink-0 items-center justify-center rounded-lg border border-border p-1 text-muted transition-colors hover:bg-surface hover:text-text"
              aria-label="Voltar"
            >
              <IconChevronLeft className="h-6 w-6" />
            </button>
          )}
          <h1 className="text-2xl font-semibold text-text ml-1">{pageTitle}</h1>
        </div>
        {isAdmin && showPiecesView && (
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setCreateOpen(true);
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <IconPlus className="h-4 w-4" />
            Obra
          </button>
        )}
        {isAdmin && adminSection === 'categories' && (
          <button
            type="button"
            onClick={openCreateCategoryModal}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <IconPlus className="h-4 w-4" />
            Categoria
          </button>
        )}
        {isAdmin && adminSection === 'themes' && (
          <button
            type="button"
            onClick={openCreateThemeModal}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <IconPlus className="h-4 w-4" />
            Tema
          </button>
        )}
      </div>

      {isAdmin && adminSection === 'menu' && (
        <div className="mt-6">
          <RepertoireAdminMenu onSelect={openAdminSection} />
        </div>
      )}
      </div>

      {showPiecesView && (
        <div className={useFixedListLayout ? 'flex min-h-0 flex-1 flex-col' : undefined}>
          <RepertoirePiecesSection
            orgSlug={orgSlug!}
            pieces={pieces}
            categories={categories}
            themes={themes}
            isLoading={isLoading}
            isCategoriesLoading={isTaxonomyLoading || !memberFiltersReady || !pickerContextReady}
            showCategoryPicker={showCategoryPicker}
            pickerGroups={pickerGroups}
            showGroupPicker={showGroupPicker}
            implicitGroupId={implicitGroupId}
            pieceMemberships={pieceMemberships}
            groupScope={isAdmin ? groupFilter : memberGroupId}
            pickerSelectedGroupId={urlGroupId}
            onPickerSelectGroup={handlePickerSelectGroup}
            onPickerBackToGroups={handlePickerBackToGroups}
            onCategoryPickerSelect={handleCategoryPickerSelect}
            isAdmin={isAdmin}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={(nextCategoryId) =>
              updateParams({
                [REPERTOIRE_CATEGORY_QUERY]: encodeRepertoireCategoryParam(nextCategoryId),
              })
            }
            themeFilter={themeFilter}
            onThemeFilterChange={(themeId) => updateParams({ [REPERTOIRE_THEME_QUERY]: themeId })}
            sortFilter={sortFilter}
            onSortFilterChange={(sort) =>
              updateParams({
                [REPERTOIRE_SORT_QUERY]: sort === DEFAULT_PIECE_LIST_SORT ? null : sort,
              })
            }
            memberCategoryId={memberCategoryId}
            onOpenCategoryPicker={handleOpenCategoryPicker}
          />
        </div>
      )}

      {isAdmin && adminSection === 'categories' && (
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${scrollContentEndPaddingClass}`}
        >
          {isTaxonomyLoading ? (
            <OrgListRowsSkeleton count={5} />
          ) : (
            <RepertoireCategoriesSection
              categories={categories}
              onEdit={openEditCategoryModal}
              onReorder={handleReorderCategories}
              isReordering={isReorderingCategories}
              reorderError={categoryReorderError}
            />
          )}
        </div>
      )}

      {isAdmin && adminSection === 'themes' && (
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${scrollContentEndPaddingClass}`}
        >
          {isTaxonomyLoading ? (
            <OrgListRowsSkeleton count={5} />
          ) : (
            <RepertoireThemesSection themes={themes} onEdit={openEditThemeModal} />
          )}
        </div>
      )}

      {isAdmin && adminSection === 'reports' && org && (
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${scrollContentEndPaddingClass}`}
        >
          <RepertoireReportsSection
            organizationId={org.id}
            orgSlug={org.slug}
            categories={categories}
            groups={groups}
          />
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => !isSubmitting && setCreateOpen(false)}
        title="Nova obra"
      >
        <form onSubmit={handleCreatePiece} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-text">Título</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-text">Compositor</span>
            <input
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            />
          </label>
          <PieceAliasesField value={aliases} onChange={setAliases} />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-text">Categoria</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          {themes.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-text">Temas</legend>
              <div className="flex flex-wrap gap-2">
                {themes.map((theme) => {
                  const checked = selectedThemeIds.includes(theme.id);
                  return (
                    <label
                      key={theme.id}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                        checked ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() =>
                          setSelectedThemeIds((prev) =>
                            checked
                              ? prev.filter((id) => id !== theme.id)
                              : [...prev, theme.id],
                          )
                        }
                      />
                      {theme.name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isSubmitting ? 'Salvando…' : 'Criar obra'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={taxonomyModal !== null}
        onClose={() => !isSavingTaxonomy && setTaxonomyModal(null)}
        title={
          taxonomyModal?.kind === 'category'
            ? taxonomyModal.id
              ? 'Editar categoria'
              : 'Nova categoria'
            : taxonomyModal?.id
              ? 'Editar tema'
              : 'Novo tema'
        }
      >
        {taxonomyModal && (
          <form onSubmit={handleSaveTaxonomy} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-text">Nome</span>
              <input
                value={taxonomyModal.name}
                onChange={(event) =>
                  setTaxonomyModal({ ...taxonomyModal, name: event.target.value })
                }
                required
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
              />
            </label>
            {taxonomyModal.kind === 'category' && (
              <CategoryHuePicker
                hue={taxonomyModal.hue}
                onChange={(hue) => setTaxonomyModal({ ...taxonomyModal, hue })}
                previewLabel={taxonomyModal.name.trim() || 'Categoria'}
              />
            )}
            {taxonomyError && <p className="text-sm text-red-600">{taxonomyError}</p>}
            <div className="flex justify-between gap-2">
              {taxonomyModal.id ? (
                <button
                  type="button"
                  onClick={handleDeleteTaxonomy}
                  disabled={isSavingTaxonomy}
                  className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600"
                >
                  Excluir
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTaxonomyModal(null)}
                  disabled={isSavingTaxonomy}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingTaxonomy}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {isSavingTaxonomy ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
