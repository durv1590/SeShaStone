import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';

interface CmsPage {
  slug: string;
  title: string;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

type Props = { params: Promise<{ slug: string }> };
const DRAFT_PREFIX = 'DRAFT —';

async function getPage(slug: string) {
  try {
    return await api<CmsPage>(`/pages/${encodeURIComponent(slug)}`, { revalidate: 60 });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPage((await params).slug);
  return pageMetadata({
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
    path: `/pages/${page.slug}`,
    // Draft legal pages stay out of search engines until approved.
    noindex: page.content.startsWith(DRAFT_PREFIX),
  });
}

export default async function CmsPageView({ params }: Props) {
  const page = await getPage((await params).slug);
  const [first, ...rest] = page.content.split(/\n{2,}/);
  const isDraft = first.startsWith(DRAFT_PREFIX);
  const paragraphs = isDraft ? rest : [first, ...rest];
  return (
    <>
      <Breadcrumbs items={[{ name: page.title, path: `/pages/${page.slug}` }]} />
      <article className="section container" style={{ paddingTop: 16 }}>
        <div className="prose">
          <h1 style={{ marginBottom: 24 }}>{page.title}</h1>
          {isDraft && <p className="draft-banner" role="note">{first}</p>}
          {paragraphs.map((para, i) => <p key={i}>{para}</p>)}
          <p className="muted" style={{ fontSize: '0.8rem' }}>Last updated {new Date(page.updatedAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
        </div>
      </article>
    </>
  );
}
