import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { datalabService } from '../../../services/datalabService';

const DownloadButton = ({ filters, format }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await datalabService.downloadExport(filters, format);
      // Download is handled by the service which triggers browser download
    } catch (err) {
      setError('Download failed. Please try again.');
      console.error('Download error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleDownload}
        disabled={isLoading}
        className={`flex items-center gap-2 px-6 py-3 rounded-md text-white font-semibold transition-all shadow-lg ${isLoading
            ? 'bg-zinc-400 cursor-not-allowed'
            : 'bg-zinc-900 hover:bg-zinc-800 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200'
          }`}
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            Generating...
          </>
        ) : (
          <>
            <Download size={20} />
            Download {format.toUpperCase()}
          </>
        )}
      </button>
      {error && (
        <p className="text-red-600 dark:text-red-400 text-sm mt-2">{error}</p>
      )}
    </div>
  );
};

export default DownloadButton;

