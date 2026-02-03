import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { datalabService } from '../../../services/datalabService';

const DownloadButton = ({ filters, format, bucketing }) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await datalabService.downloadExport(filters, format, bucketing);
    } catch (error) {
      console.error('Download failed', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className={`
        w-full py-4 px-6 rounded-lg font-medium text-sm flex items-center justify-center space-x-2 transition-all duration-200 border border-zinc-700
        ${loading
          ? 'bg-zinc-800/50 text-zinc-500 cursor-not-allowed border-zinc-800'
          : 'bg-transparent text-zinc-300 hover:bg-zinc-800/50 hover:text-white hover:border-zinc-500 active:bg-zinc-800'
        }
      `}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Preparing Export...</span>
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          <span>Download Export</span>
        </>
      )}
    </button>
  );
};


export default DownloadButton;

