import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

interface CmsPage {
  title: string;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

type Params = Promise<{ slug: string }>;

async function getPage(slug: string) {
  try {
    return await api<CmsPage>(`/pages/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = await getPage((await params).slug);
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined };
}

export default async function CmsPageView({ params }: { params: Params }) {
  const page = await getPage((await params).slug);
  return (
    <article className="container section" style={{ maxWidth: 760 }}>
      <h1 className="section-title">{page.title}</h1>
      {page.content.split(/\n{2,}/).map((para, i) => (
        <p key={i} style={{ lineHeight: 1.8 }}>{para}</p>
      ))}
    </article>
  );
}
