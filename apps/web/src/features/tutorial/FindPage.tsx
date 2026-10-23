import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { BackIcon } from '../../ui/icons';
import { CharFinder } from './CharFinder';

/** 글자 찾기 화면. 디자인 검수 전이라 /lab/find에 둔다 */
export function FindPage() {
  const { t } = useTranslation();
  return (
    <main className="screen">
      <header className="screen-header">
        <Link className="icon-btn header-back" to="/steps" aria-label={t('result.steps')}>
          <BackIcon />
        </Link>
      </header>
      <h1 className="screen-title">{t('find.title')}</h1>
      <p className="screen-body">{t('find.lead')}</p>
      <CharFinder />
    </main>
  );
}
