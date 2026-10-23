import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { BackIcon } from '../../ui/icons';
import { KeyboardKeys } from './KeyboardKeys';

/** 키보드 설명서 (/keys): 단계별 익히기에서 언제든 다시 보는 키 설명 */
export function KeysPage() {
  const { t } = useTranslation();
  return (
    <main className="screen">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/steps" aria-label={t('result.steps')}>
          <BackIcon />
        </Link>
      </header>
      <h1 className="screen-title">{t('keys.manual')}</h1>
      <p className="screen-body">{t('keys.lead')}</p>
      <KeyboardKeys />
    </main>
  );
}
