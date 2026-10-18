interface ToastProps {
  message: string;
  /** 있으면 주 동작 버튼을 보여 준다 */
  action?: { label: string; onClick: () => void };
  closeLabel: string;
  onClose: () => void;
}

/** 화면 아래에 뜨는 짧은 알림. 키보드가 닫혀 있는 화면(홈·설정)에서만 쓴다 */
export function Toast({ message, action, closeLabel, onClose }: ToastProps) {
  return (
    <div className="toast" role="status">
      <p>{message}</p>
      {action ? (
        <button type="button" className="toast-action" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
      <button type="button" className="btn-quiet" onClick={onClose}>
        {closeLabel}
      </button>
    </div>
  );
}
