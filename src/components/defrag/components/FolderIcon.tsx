export function FolderIcon({ open }: { open?: boolean }) {
  return (
    <svg className="dfg-folder" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      {open ? (
        <path d="M1.6 13.2 3.3 7.4a1 1 0 0 1 .96-.7h9.6a.6.6 0 0 1 .58.77l-1.5 5.2a1 1 0 0 1-.96.73H2.2a.6.6 0 0 1-.6-.7Z
                 M1.4 11.6V3.6a.9.9 0 0 1 .9-.9h3.3l1.5 1.6h5a.9.9 0 0 1 .9.9v1.2"
          fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      ) : (
        <path d="M1.4 12.4V3.6a.9.9 0 0 1 .9-.9h3.3l1.5 1.6h6a.9.9 0 0 1 .9.9v7.2a.9.9 0 0 1-.9.9H2.3a.9.9 0 0 1-.9-.9Z"
          fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      )}
    </svg>
  );
}
