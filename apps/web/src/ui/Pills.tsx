/** 알약 탭 묶음: 하나만 고르는 선택 (종목·시간·도움말 대기 시간) */
export function Pills<T extends string | number>({
  label,
  value,
  options,
  onChange,
  small = false,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
  small?: boolean;
}) {
  return (
    <div className={`stage-tabs${small ? ' is-small' : ''}`} role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          className="stage-tab"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
