import { useMemo, useState, type ReactNode } from 'react';
import { ARTICLES, SECTIONS, type Article, type ArticleSection } from '../content/articles.ts';
import { formatFullDate } from '../lib/dates.ts';
import { callPhone } from '../lib/telegram.ts';
import { ChevronLeftIcon, ChevronRightIcon, PhoneIcon, SearchIcon } from '../components/icons.tsx';
import { SectionTitle } from '../components/ui.tsx';
import { cn } from '../utils/cn.ts';

type Props = { articleId: string | null; onOpenArticle: (id: string) => void; onBack: () => void };

type ListState = { ordered: boolean; items: string[] };

const SECTION_ORDER: ArticleSection[] = ['news', 'work', 'dressings', 'contacts'];
const PHONE_PATTERN = /(\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/;

/** Подсветка мест «[заполнить]» внутри строки. */
const renderInline = (text: string): ReactNode[] =>
  text.split(/(\[[^\]]+\])/g).map((part, index) =>
    /^\[[^\]]+\]$/.test(part) ? (
      <mark key={index} className="fill-mark">
        {part.slice(1, -1)}
      </mark>
    ) : (
      part
    ),
  );

/** Простая разметка статьи: ## заголовки, списки, плашки, строки контактов. */
const ArticleBody = ({ body }: { body: string }) => {
  const lines = body.trim().split('\n');
  const blocks: ReactNode[] = [];
  const state: { list: ListState | null; paragraph: string[] } = { list: null, paragraph: [] };

  const flush = () => {
    if (state.paragraph.length) {
      blocks.push(
        <p key={`p${blocks.length}`} className="article__p">
          {renderInline(state.paragraph.join(' '))}
        </p>,
      );
      state.paragraph = [];
    }
    const list = state.list;
    if (list) {
      const items = list.items.map((item, index) => <li key={index}>{renderInline(item)}</li>);
      blocks.push(
        list.ordered ? (
          <ol key={`l${blocks.length}`} className="article__list article__list--ordered">
            {items}
          </ol>
        ) : (
          <ul key={`l${blocks.length}`} className="article__list">
            {items}
          </ul>
        ),
      );
      state.list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      blocks.push(
        <h2 key={`h${blocks.length}`} className="article__h">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith('> ')) {
      flush();
      blocks.push(
        <p key={`q${blocks.length}`} className="article__note">
          {renderInline(line.slice(2))}
        </p>,
      );
    } else if (line.startsWith('|')) {
      flush();
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      const phone = cells.find((cell) => PHONE_PATTERN.test(cell));
      const text = cells.filter((cell) => cell !== phone);
      blocks.push(
        <div key={`c${blocks.length}`} className="article__contact">
          <span className="contact__text">
            <span className="contact__value">{renderInline(text[0] ?? '')}</span>
            {text.length > 1 && <span className="contact__label">{renderInline(text.slice(1).join(' · '))}</span>}
            {phone && <span className="contact__label num">{phone}</span>}
          </span>
          {phone && (
            <button type="button" className="icon-btn" aria-label={`Позвонить: ${text[0] ?? phone}`} onClick={() => callPhone(phone)}>
              <PhoneIcon width={20} height={20} />
            </button>
          )}
        </div>,
      );
    } else if (/^(-|\d+\.)\s/.test(line)) {
      const ordered = /^\d+\./.test(line);
      if (state.paragraph.length) flush();
      if (state.list && state.list.ordered !== ordered) flush();
      const current = state.list ?? { ordered, items: [] };
      current.items.push(line.replace(/^(-|\d+\.)\s/, ''));
      state.list = current;
    } else {
      if (state.list) flush();
      state.paragraph.push(line);
    }
  }
  flush();
  return <div className="article">{blocks}</div>;
};

const ArticleView = ({ article, onBack }: { article: Article; onBack: () => void }) => (
  <main className="page">
    <button type="button" className="back-link" onClick={onBack}>
      <ChevronLeftIcon width={20} height={20} />
      Справка
    </button>
    <header className="stack" style={{ gap: 8 }}>
      <div className="tags">
        <span className="tag tag--accent">{SECTIONS[article.section]}</span>
        {article.draft && <span className="tag tag--soon">Черновик</span>}
      </div>
      <h1 className="h1 h1--sm">{article.title}</h1>
      <span className="muted small">Обновлено {formatFullDate(article.date)}</span>
    </header>
    <div className="card card--pad">
      <ArticleBody body={article.body} />
    </div>
  </main>
);

export const InfoPage = ({ articleId, onOpenArticle, onBack }: Props) => {
  const [query, setQuery] = useState('');
  const article = articleId ? ARTICLES.find((item) => item.id === articleId) : undefined;

  const found = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ARTICLES.filter((item) => !needle || `${item.title} ${item.body}`.toLowerCase().includes(needle));
  }, [query]);

  if (article) return <ArticleView article={article} onBack={onBack} />;

  return (
    <main className="page">
      <header className="page-head__text">
        <h1 className="h1">Справка</h1>
        <span className="muted">Новости, приказы и инструкции для всех сотрудников</span>
      </header>

      <label className="search">
        <SearchIcon className="search__icon" width={20} height={20} />
        <input
          className="input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по статьям"
          aria-label="Поиск по статьям"
        />
      </label>

      {SECTION_ORDER.map((section) => {
        const items = found.filter((item) => item.section === section).sort((a, b) => (a.date < b.date ? 1 : -1));
        if (items.length === 0) return null;
        return (
          <section key={section} className="stack">
            <SectionTitle count={items.length}>{SECTIONS[section]}</SectionTitle>
            <div className="list">
              {items.map((item) => (
                <button key={item.id} type="button" className="lrow" onClick={() => onOpenArticle(item.id)}>
                  <span className="lrow__main">
                    <span className="prow__name" style={{ whiteSpace: 'normal' }}>
                      {item.title}
                    </span>
                    <span className={cn('prow__sub')}>
                      {formatFullDate(item.date)}
                      {item.draft ? ' · черновик' : ''}
                    </span>
                  </span>
                  <ChevronRightIcon className="lrow__chev" width={16} height={16} />
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {found.length === 0 && <p className="empty-note">Ничего не нашлось по запросу «{query}».</p>}
    </main>
  );
};
