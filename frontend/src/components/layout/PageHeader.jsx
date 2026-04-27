import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { dataAPI } from '../../services/api';

const PageHeader = ({ title, actions, showBack = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [deviceDisplayName, setDeviceDisplayName] = useState(null);

  const params = new URLSearchParams(location.search);
  const queryDeviceId = params.get('device');

  // Detect a MAC-shaped path segment (e.g. /admin/devices/24:4C:AB:46:A6:69)
  const MAC_RE = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;
  const pathParts = location.pathname.split('/').filter(Boolean);
  const lastPathPart = pathParts[pathParts.length - 1] || '';
  const pathDeviceId = MAC_RE.test(lastPathPart) ? lastPathPart : null;

  const deviceId = queryDeviceId || pathDeviceId;

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
            const id = device.device_id && !MAC_RE.test(device.device_id) ? device.device_id : null;
            setDeviceDisplayName(device.display_name || id || 'Device');
          } else {
            setDeviceDisplayName('Device');
          }
        }
      } catch (error) {
        console.error('Error fetching device for header:', error);
        setDeviceDisplayName('Device');
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

    // Don't expose raw MACs in the title
    if (MAC_RE.test(lastPart)) return 'Device';

    if (deviceId) return 'Device';

    // Default formatting
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
  };

  const pageTitle = getPageTitle();

  // Don't render the header at all when there's nothing meaningful to show
  if (!pageTitle && !actions && !showBack) return null;

  return (
    <header className="flex items-center justify-between py-4 sm:py-6 mb-1">
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
