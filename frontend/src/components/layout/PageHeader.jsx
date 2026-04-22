import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { dataAPI } from '../../services/api';

const PageHeader = ({ title, actions, showBack = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [deviceDisplayName, setDeviceDisplayName] = useState(null);

  const params = new URLSearchParams(location.search);
  const deviceId = params.get('device');

  useEffect(() => {
    const fetchDeviceName = async () => {
      if (!deviceId) {
        setDeviceDisplayName(null);
        return;
      }

      try {
        const response = await dataAPI.getDevices();
        if (response.data && response.data.devices) {
          const device = response.data.devices.find(
            (d) => d.device_id === deviceId || d.mac_address === deviceId
          );
          if (device) {
            setDeviceDisplayName(device.display_name || device.device_id);
          }
        }
      } catch (error) {
        console.error('Error fetching device for header:', error);
      }
    };

    fetchDeviceName();
  }, [deviceId]);

  const getPageTitle = () => {
    if (title) return title;
    if (deviceDisplayName) return deviceDisplayName;
    
    const path = location.pathname;
    // Don't render a title for the overview — the page speaks for itself
    if (path === '/' || path === '/dashboard') return null;
    
    const parts = path.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    
    // Map specific paths to friendly names
    const routeMap = {
      'admin': 'Management',
      'ventilation': 'Ventilation Guide'
    };
    
    if (routeMap[lastPart]) return routeMap[lastPart];
    
    if (deviceId) return `Device: ${deviceId}`;
    
    // Default formatting
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
  };

  const pageTitle = getPageTitle();

  // Don't render the header at all when there's nothing meaningful to show
  if (!pageTitle && !actions && !showBack) return null;

  return (
    <header className="flex items-center justify-between py-6 mb-2">
      <div className="flex items-center gap-4">
        {showBack && (
          <button 
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-md hover:bg-stone-100 text-stone-500 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {pageTitle && (
          <h1 className="text-sm font-bold text-stone-900 uppercase tracking-widest">
            {pageTitle}
          </h1>
        )}
      </div>
      
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
