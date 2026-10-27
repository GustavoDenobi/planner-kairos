import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PartWithDivisions } from '@/application/ports/part-repository';
import { useEnsemble } from '@/ui/app/AppServicesContext';
import { useAuth } from '@/ui/app/auth/AuthProvider';
import { useOrg } from '@/ui/app/OrgProvider';
import { StudyMetronomeCard } from '@/ui/features/study-tools/StudyMetronomeCard';
import { StudyRecorderCard } from '@/ui/features/study-tools/StudyRecorderCard';
import { StudyTimerCard } from '@/ui/features/study-tools/StudyTimerCard';
import { StudyTunerCard } from '@/ui/features/study-tools/StudyTunerCard';
import { mapTransposePartOptions } from '@/ui/features/repertoire/transpose-part-options';
import { orgPageContentClass } from '@/ui/layouts/OrgListPageLayout';

export function StudyToolsPage() {
  const { orgSlug } = useParams();
  const ensemble = useEnsemble();
  const { userId } = useAuth();
  const { resolveOrgBySlug } = useOrg();
  const org = orgSlug ? resolveOrgBySlug(orgSlug) : null;

  const [parts, setParts] = useState<PartWithDivisions[]>([]);
  const [recorderMicActive, setRecorderMicActive] = useState(false);
  const stopTunerMicRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!org) {
      setParts([]);
      return;
    }

    let cancelled = false;

    void ensemble.listParts(org.id).then((result) => {
      if (cancelled) {
        return;
      }
      setParts(result.ok ? result.value : []);
    });

    return () => {
      cancelled = true;
    };
  }, [ensemble, org]);

  const partOptions = useMemo(() => mapTransposePartOptions(parts), [parts]);

  const handleBeforeRecording = useCallback(() => {
    stopTunerMicRef.current?.();
  }, []);

  const registerTunerMicStop = useCallback((stop: (() => void) | null) => {
    stopTunerMicRef.current = stop;
  }, []);

  return (
    <div className={`mx-auto flex w-full flex-col gap-6 ${orgPageContentClass}`}>
      <header>
        <h1 className="text-2xl font-semibold text-text">Ferramentas</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <StudyTunerCard
          userId={userId}
          partOptions={partOptions}
          onRegisterMicStop={registerTunerMicStop}
          microphoneBlocked={recorderMicActive}
        />
        <StudyMetronomeCard userId={userId} />
        <div className="lg:col-span-2">
          <StudyTimerCard />
        </div>
        <div className="lg:col-span-2">
          <StudyRecorderCard
            organizationId={org?.id ?? null}
            userId={userId}
            onBeforeStart={handleBeforeRecording}
            onSessionActiveChange={setRecorderMicActive}
          />
        </div>
      </div>
    </div>
  );
}
