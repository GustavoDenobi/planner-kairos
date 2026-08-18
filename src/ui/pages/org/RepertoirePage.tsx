import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { PieceCategory, PieceListItem, PieceTheme } from '@/domain/repertoire';
import { useRepertoire } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { useLoadingBar } from '@/ui/app/loading-bar/useLoadingBar';
import { Modal } from '@/ui/components/Modal';
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
import { RepertoireThemesSection } from '@/ui/features/repertoire/RepertoireThemesSection';
import {
  loadRepertoireMemberFilters,
  saveRepertoireMemberFilters,
} from '@/ui/features/repertoire/repertoire-filters-storage';
import { repertoireErrorMessage } from '@/ui/features/repertoire/repertoire-labels';
import { PieceAliasesField } from '@/ui/features/repertoire/PieceAliasesField';
import {
  parseRepertoireSection,
  repertoireSectionQueryValue,
} from '@/ui/features/repertoire/repertoire-routes';
import {
  orgListPageHeightClass,
  orgPageContentClass,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const repertoire = useRepertoire();
  const { userId } = useAuth();
  const { organizations } = useOrg();
  const org = organizations.find((o) => o.slug === orgSlug);

  const isAdmin = org?.accessRole === 'admin' || org?.accessRole === 'owner';

  const adminSection: RepertoireAdminSection | 'menu' = isAdmin
    ? (parseRepertoireSection(searchParams.get('secao')) ?? 'menu')
    : 'pieces';

  function openAdminSection(section: RepertoireAdminSection) {
    setSearchParams({ secao: repertoireSectionQueryValue(section) });
  }

  function openAdminMenu() {
    setSearchParams({});
  }

  const [pieces, setPieces] = useState<PieceListItem[]>([]);
  const [categories, setCategories] = useState<PieceCategory[]>([]);
  const [themes, setThemes] = useState<PieceTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(true);
  const [memberFiltersReady, setMemberFiltersReady] = useState(isAdmin);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [memberCategoryId, setMemberCategoryId] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(true);
  const previousAdminSectionRef = useRef<RepertoireAdminSection | 'menu'>(adminSection);

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

  const showPiecesView = isAdmin ? adminSection === 'pieces' : true;

  const isPageLoading =
    isTaxonomyLoading ||
    (showPiecesView && isLoading) ||
    (!isAdmin && !memberFiltersReady);
  useLoadingBar('repertoire', isPageLoading);

  const adminSectionTitles: Record<RepertoireAdminSection, string> = {
    pieces: 'Peças',
    categories: 'Categorias',
    themes: 'Temas',
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

    setMemberCategoryId(resolvedCategoryId);
    setShowCategoryPicker(resolvedCategoryId === '');
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

    const searchOptions = isAdmin
      ? {
          query: searchQuery || undefined,
          categoryId: categoryFilter || undefined,
          themeIds: themeFilter ? [themeFilter] : undefined,
        }
      : {
          query: searchQuery || undefined,
          categoryId: memberCategoryId || undefined,
          themeIds: themeFilter ? [themeFilter] : undefined,
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
    repertoire,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (
      isAdmin &&
      adminSection === 'pieces' &&
      previousAdminSectionRef.current !== 'pieces'
    ) {
      setShowCategoryPicker(true);
    }
    previousAdminSectionRef.current = adminSection;
  }, [isAdmin, adminSection]);

  useEffect(() => {
    loadTaxonomy();
    loadMemberFilters();
  }, [loadTaxonomy, loadMemberFilters]);

  useEffect(() => {
    loadPieces();
  }, [loadPieces]);

  useEffect(() => {
    if (!org || !userId || isAdmin || !memberCategoryId) {
      return;
    }
    saveRepertoireMemberFilters(org.id, userId, {
      categoryId: memberCategoryId,
    });
  }, [org, userId, isAdmin, memberCategoryId]);

  if (!org) {
    return null;
  }

  function handleCategoryPickerSelect(categoryId: string) {
    if (isAdmin) {
      setCategoryFilter(categoryId);
    } else {
      setMemberCategoryId(categoryId);
    }
    setShowCategoryPicker(false);
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

  const useFixedListLayout =
    showPiecesView ||
    (isAdmin && (adminSection === 'categories' || adminSection === 'themes'));

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
              onClick={openAdminMenu}
              className="flex shrink-0 items-center justify-center rounded-lg border border-border p-1 text-muted transition-colors hover:bg-surface hover:text-text"
              aria-label="Voltar ao menu"
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
            Peça
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
            isCategoriesLoading={isTaxonomyLoading || !memberFiltersReady}
            showCategoryPicker={showCategoryPicker}
            onCategoryPickerSelect={handleCategoryPickerSelect}
            isAdmin={isAdmin}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            themeFilter={themeFilter}
            onThemeFilterChange={setThemeFilter}
            memberCategoryId={memberCategoryId}
            onMemberCategoryChange={setMemberCategoryId}
          />
        </div>
      )}

      {isAdmin && adminSection === 'categories' && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <RepertoireCategoriesSection
            categories={categories}
            onCreate={openCreateCategoryModal}
            onEdit={openEditCategoryModal}
          />
        </div>
      )}

      {isAdmin && adminSection === 'themes' && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <RepertoireThemesSection
            themes={themes}
            onCreate={openCreateThemeModal}
            onEdit={openEditThemeModal}
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
