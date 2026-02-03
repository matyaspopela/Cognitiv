import apiClient from './api'

export const datalabService = {
  /**
   * Get estimated record count based on filters
   * @param {Object} filters
   * @param {string} bucketing
   */
  previewQuery: async (filters, bucketing) => {
    const response = await apiClient.post('/datalab/preview', { filters, bucketing });
    return response;
  },

  /**
   * Trigger data export and download
   * @param {Object} filters
   * @param {string} format 'csv', 'jsonl'
   * @param {string} bucketing 'raw', '15m', '1h', '1d'
   */
  downloadExport: async (filters, format, bucketing) => {
    try {
      // Build query parameters
      const params = new URLSearchParams({
        start: filters.start || filters.dateRange?.start,
        end: filters.end || filters.dateRange?.end,
        format: format || 'csv',
        bucketing: bucketing || 'raw'
      });

      // Add rooms if specified
      if (filters.rooms && filters.rooms.length > 0) {
        params.append('rooms', filters.rooms.join(','));
      }

      // Make request with blob response type
      const response = await apiClient.get(`/datalab/export?${params.toString()}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;

      // Set filename from response header or generate default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `cognitiv_export_${format}_${Date.now()}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { status: 'success' };
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  },

  /**
   * Get available filter options (teachers, subjects, etc.) - Legacy support or empty
   */
  getFilterOptions: async () => {
    // Deprecated but keeping for interface compatibility if needed, though mostly unused now
    return { data: {} };
  }
}