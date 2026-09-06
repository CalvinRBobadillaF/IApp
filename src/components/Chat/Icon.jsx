const paths = {
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  send: "m5 12 7-7 7 7M12 5v14",
  attach: "m9 12 6-6a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7l9-9M6 15l9-9",
  file: "M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 13h8M8 17h5",
  lock: "M6 10h12v11H6V10Zm2 0V6a4 4 0 0 1 8 0v4M12 14v3",
  chat: "M21 11a8 8 0 0 1-8 8H7l-5 3V11a9 9 0 0 1 19 0ZM7 10h10M7 14h6",
  image: "M3 3h18v18H3V3Zm0 13 5-5 4 4 3-3 6 6M16 7h.01",
  settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20",
};

export default function Icon({ name, className = "" }) {
  return (
    <svg className={className} aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.chat} />
    </svg>
  );
}
