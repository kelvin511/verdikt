import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchADRs, refLabel, type ADRSummary } from "../api";

export default function ListView() {
  const [adrs, setAdrs] = useState<ADRSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchADRs()
      .then(setAdrs)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!adrs) return <p>Loading...</p>;
  if (adrs.length === 0) {
    return (
      <p>
        No ADRs yet. Run <code>verdikt scan</code> in your repo to generate some.
      </p>
    );
  }

  return (
    <ul className="adr-list">
      {adrs.map((adr) => (
        <li key={adr.slug}>
          <Link to={`/adr/${adr.slug}`}>
            <span className="adr-title">{adr.title}</span>
            <span className="adr-meta">
              {refLabel(adr)} &middot; {adr.date} &middot; {adr.author}
              {adr.branch ? (
                <>
                  {" "}
                  &middot; <code>{adr.branch}</code>
                </>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
