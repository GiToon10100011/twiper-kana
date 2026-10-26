import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/** 주의사항 항목. 화면에 이 순서로 보인다 */
const RULES = ['keyboard', 'commit', 'convert', 'fix', 'time', 'help', 'speed'] as const;

interface ExamRulesProps {
  open: boolean;
  /** 설정에서 한자를 읽기대로 쳐도 되게 했으면 3번 규칙을 가타카나만 말한다 */
  readingOk?: boolean;
  /** 닫기 버튼·바깥 누르기·ESC. 버튼을 누른 그 탭 안에서 부르므로 여기서 입력창에 포커스하면 키보드가 올라온다 */
  onClose: () => void;
}

/**
 * 종합 테스트 주의사항 창 (2026-10-26 사용자 요청: 「언제든 열고 닫을 수 있게」).
 * 브라우저의 <dialog>를 모달로 열어 뒤 화면을 막고 ESC로 닫게 한다.
 * 모달이 열린 동안 바깥은 포커스할 수 없으므로, 먼저 닫은 다음 onClose를 부른다
 */
export function ExamRules({ open, onClose, readingOk = false }: ExamRulesProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    ref.current?.close();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className="rules-dialog"
      aria-labelledby="exam-rules-title"
      // ESC로 닫힌 경우. 버튼으로 닫았으면 이미 onClose를 불렀지만 한 번 더 불러도 같다
      onClose={onClose}
      // 안쪽 상자 바깥(배경)을 누르면 닫는다
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      {/* 닫혀 있을 때는 내용을 그리지 않는다 (화면 낭독기가 숨은 글을 읽지 않게) */}
      {open ? (
        <div className="rules-body">
          <h2 id="exam-rules-title" className="rules-title">
            {t('exam.rules.title')}
          </h2>
          <ol className="rules-list">
            {RULES.map((rule) => {
              const id = rule === 'convert' && readingOk ? 'convertReading' : rule;
              return (
                <li key={rule}>
                  <strong>{t(`exam.rules.${id}.rule`)}</strong>
                  <span>{t(`exam.rules.${id}.detail`)}</span>
                </li>
              );
            })}
          </ol>
          <button type="button" className="btn btn-primary rules-close" onClick={close}>
            {t('exam.rules.close')}
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
