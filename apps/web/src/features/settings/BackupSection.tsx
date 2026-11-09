import { useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrainingRepo } from '@twiper/core';
import {
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
  saveFile,
} from '../../lib/backup';
import { trainingRepo } from '../../lib/db';

interface Status {
  readonly text: string;
  readonly warn: boolean;
}

/** 설정의 기록 백업: 내보내기(파일로 저장)와 가져오기(파일을 골라 지금 기록에 합치기) */
export function BackupSection({ repo }: { repo?: TrainingRepo }) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<Status | null>(null);

  // 공유 창은 누른 그 자리에서 열어야 하므로 내보낼 파일을 미리 만든다. 가져온 뒤에는 다시 만든다
  useEffect(() => {
    let live = true;
    void createBackup(repo ?? trainingRepo()).then((backup) => {
      if (!live) return;
      setFile(new File([JSON.stringify(backup)], backupFileName(), { type: 'application/json' }));
    });
    return () => {
      live = false;
    };
  }, [repo, revision]);

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const chosen = input.files?.[0];
    // 같은 파일을 다시 골라도 onChange가 오게 비운다
    input.value = '';
    if (!chosen) return;
    const backup = parseBackup(await chosen.text().catch(() => ''));
    if (!backup) {
      setStatus({ text: t('settings.importInvalid'), warn: true });
      return;
    }
    const result = await restoreBackup(backup, repo ?? trainingRepo());
    setRevision((n) => n + 1);
    if (!result.persisted) {
      setStatus({ text: t('settings.importNotSaved'), warn: true });
      return;
    }
    const text =
      result.attempts > 0
        ? t('settings.importedLines', { count: result.attempts })
        : result.changed
          ? t('settings.importedProgress')
          : t('settings.importedNothing');
    setStatus({ text, warn: false });
  };

  return (
    <>
      <h2 className="section-label">{t('settings.backup')}</h2>
      <ul className="nav-list settings-list">
        <li>
          <div className="setting-row">
            <span>
              <span className="setting-name">{t('settings.export')}</span>
              <small>{t('settings.exportHint')}</small>
            </span>
            <button
              type="button"
              className="btn"
              disabled={file === null}
              onClick={() => {
                if (file) void saveFile(file);
              }}
            >
              {t('settings.exportButton')}
            </button>
          </div>
        </li>
        <li>
          <div className="setting-row">
            <span>
              <span className="setting-name">{t('settings.import')}</span>
              <small>{t('settings.importHint')}</small>
            </span>
            <label className="btn">
              {t('settings.importButton')}
              <input
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                onChange={(event) => void onImport(event)}
              />
            </label>
          </div>
        </li>
      </ul>
      <p className={`backup-status${status?.warn ? ' is-warning' : ''}`} role="status">
        {status?.text ?? ''}
      </p>
    </>
  );
}
