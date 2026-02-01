import apiClient from './api'

export const datalabService = {
  /**
   * Get estimated record count based on filters
   * @param {Object} filters
   */
  previewQuery: async (filters) => {
    const response = await apiClient.post('/datalab/preview', { filters });
    return response;
  },

  /**
   * Trigger data export and download
   * @param {Object} filters
   * @param {string} format 'csv', 'jsonl', 'pdf'
   */
  downloadExport: async (filters, format) => {
    try {
      // Build query parameters
      const params = new URLSearchParams({
        start: filters.start || filters.dateRange?.start,
        end: filters.end || filters.dateRange?.end,
        format: format || 'csv'
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
   * Get saved query presets
   */
  getPresets: async () => {
    const response = await apiClient.get('/datalab/presets');
    return response;
  },

  /**
   * Save current configuration as preset
   * @param {string} name
   * @param {Object} filters
   */
  savePreset: async (name, filters) => {
    const response = await apiClient.post('/datalab/presets', { name, filters });
    return response;
  },

  /**
   * Delete a preset by ID
   * @param {string} presetId
   */
  deletePreset: async (presetId) => {
    const response = await apiClient.delete(`/datalab/presets/${presetId}`);
    return response;
  }
}
