import { describe, expect, it } from 'vitest';
import { pickStudyRecordingMimeType } from '@/ui/features/study-tools/study-recording-format';

function supports(...types: string[]) {
  return (mimeType: string) => types.includes(mimeType);
}

describe('pickStudyRecordingMimeType', () => {
  it('prefere MP4/AAC quando o navegador grava nele (toca em qualquer aparelho)', () => {
    expect(
      pickStudyRecordingMimeType(supports('audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4')),
    ).toBe('audio/mp4;codecs=mp4a.40.2');
  });

  it('usa WebM/Opus antes de MP4 sem codec (no Chrome pode sair Opus)', () => {
    expect(pickStudyRecordingMimeType(supports('audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'))).toBe(
      'audio/webm;codecs=opus',
    );
  });

  it('cai para MP4 sem codec (Safari antigo)', () => {
    expect(pickStudyRecordingMimeType(supports('audio/mp4'))).toBe('audio/mp4');
  });

  it('sem MediaRecorder devolve vazio', () => {
    expect(pickStudyRecordingMimeType(null)).toBe('');
  });
});
