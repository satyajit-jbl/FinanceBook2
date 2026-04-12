// LoadingSpinner
export default function LoadingSpinner({ fullScreen, size = 'md' }) {
  const s = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }[size];
  const spinner = (
    <svg className={`${s} animate-spin text-primary-600`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
  if (fullScreen) return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <div className="flex flex-col items-center gap-3">
        {spinner}
        <p className="text-sm text-gray-500 font-medium">Loading...</p>
      </div>
    </div>
  );
  return <div className="flex justify-center py-8">{spinner}</div>;
}
