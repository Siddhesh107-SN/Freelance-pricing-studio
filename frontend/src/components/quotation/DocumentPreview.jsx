import { ExternalLink, Printer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { estimateService } from '../../services/estimateService.js';
import { errorMessage } from '../../services/api.js';
import { Button, ErrorBanner, Spinner } from '../common/ui.jsx';

export default function DocumentPreview({ id, kind, onClose }) {
  const [url, setUrl] = useState(null);
  const [isHtml, setIsHtml] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const iframeRef = useRef(null);

  useEffect(() => {
    let revoked = null;
    let alive = true;
    setUrl(null); setError(null); setIsHtml(false);

    // Try PDF blob first, but seamlessly fall back to HTML if WeasyPrint/GTK is not installed
    estimateService.pdfBlob(id, kind)
      .then((blob) => {
        if (alive) {
          revoked = URL.createObjectURL(blob);
          setUrl(revoked);
          setIsHtml(false);
        }
      })
      .catch(async () => {
        try {
          const html = await estimateService.htmlDoc(id, kind);
          if (alive) {
            const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
            revoked = URL.createObjectURL(htmlBlob);
            setUrl(revoked);
            setIsHtml(true);
          }
        } catch (e2) {
          if (alive) setError(errorMessage(e2));
        }
      });

    return () => { alive = false; if (revoked) URL.revokeObjectURL(revoked); };
  }, [id, kind, attempt]);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  const handleOpenTab = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Document preview" className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{kind === 'internal' ? 'Internal project estimate' : 'Client quotation'}</span>
          {isHtml && (
            <span className="rounded bg-white/20 px-2 py-0.5 text-xs text-white">HTML preview (ready to print / save PDF)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {url && (
            <>
              <Button variant="secondary" onClick={handlePrint}><Printer className="h-4 w-4" /> Print / Save PDF</Button>
              <Button variant="secondary" onClick={handleOpenTab}><ExternalLink className="h-4 w-4" /> Open in tab</Button>
            </>
          )}
          <Button variant="secondary" onClick={onClose}><X className="h-4 w-4" /> Close</Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden rounded-xl bg-white">
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={() => setAttempt((a) => a + 1)} /></div>}
        {!error && !url && <Spinner label="Loading document preview" />}
        {url && <iframe ref={iframeRef} title="Document preview" src={url} className="h-full w-full" />}
      </div>
    </div>
  );
}
