import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { fetchADR, refLabel, type ADRDetail } from "../api";

export default function DetailView() {
  const { slug } = useParams<{ slug: string }>();
  const [adr, setAdr] = useState<ADRDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetchADR(slug)
      .then(setAdr)
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  if (error) return <p className="error">{error}</p>;
  if (!adr) return <p>Loading...</p>;

  return (
    <article className="adr-detail">
      <Link to="/">&larr; Back to all ADRs</Link>
      <h2>{adr.title}</h2>
      <p className="adr-meta">
        {adr.url ? (
          <a href={adr.url} target="_blank" rel="noreferrer">
            {refLabel(adr)}
          </a>
        ) : (
          <span>{refLabel(adr)}</span>
        )}
        {adr.branch ? (
          <>
            {" "}
            &middot; branch <code>{adr.branch}</code>
          </>
        ) : null}{" "}
        &middot; {adr.date} &middot; {adr.author} &middot; {adr.status}
      </p>
      <ReactMarkdown>{adr.content}</ReactMarkdown>
    </article>
  );
}
