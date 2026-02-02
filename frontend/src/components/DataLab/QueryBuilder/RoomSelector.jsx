import React, { useState, useEffect } from 'react';
import { Check, Search, ChevronDown } from 'lucide-react';
import { dataAPI } from '../../../services/api';

const RoomSelector = ({ selectedRooms, onChange }) => {
  const [rooms, setRooms] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await dataAPI.getDevices();
        // Handle API response structure: { devices: [...] } or { data: [...] }
        const rawDevices = response.data?.devices || response.data?.data || (Array.isArray(response.data) ? response.data : []);

        // Normalize device objects to have 'id' and 'name'
        const devices = (Array.isArray(rawDevices) ? rawDevices : []).map(d => ({
          ...d,
          id: d.device_id || d.mac_address || d.id,
          name: d.display_name || d.name || d.device_id || d.mac_address || 'Unknown Device'
        }));

        setRooms(devices);
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
        setError('Failed to load rooms. Please try again.');
        setRooms([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, []);

  const toggleRoom = (roomId) => {
    if (selectedRooms.includes(roomId)) {
      onChange(selectedRooms.filter((id) => id !== roomId));
    } else {
      onChange([...selectedRooms, roomId]);
    }
  };

  const filteredRooms = rooms.filter((room) =>
    (room.name || room.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectAll = () => {
    if (selectedRooms.length === rooms.length) {
      onChange([]);
    } else {
      onChange(rooms.map((r) => r.id));
    }
  };

  return (
    <div className="relative w-full">
      {error && (
        <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="relative">
        <div
          className="w-full border border-zinc-700 bg-zinc-900/30 rounded-lg px-3 py-2 text-sm text-zinc-200 cursor-pointer flex items-center justify-between transition-colors group hover:border-zinc-500"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {selectedRooms.length === 0 ? (
              <span className="text-zinc-300 text-sm font-medium">All Devices</span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-100">
                  {selectedRooms.length} Device{selectedRooms.length > 1 ? 's' : ''}
                </span>
                <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                  selected
                </span>
              </div>
            )}
          </div>
          <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className="absolute z-20 w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            <div className="p-2 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-zinc-700 rounded-md bg-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-zinc-600"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selectAll();
                }}
                className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 hover:text-emerald-300 w-full text-left px-1"
              >
                {selectedRooms.length === rooms.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="py-1">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => toggleRoom(room.id)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm transition-colors ${selectedRooms.includes(room.id)
                    ? 'bg-emerald-900/20 text-emerald-400'
                    : 'hover:bg-zinc-800/50 text-zinc-300'
                    }`}
                >
                  <span className="truncate">{room.name || room.id}</span>
                  {selectedRooms.includes(room.id) && (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </div>
              ))}
              {filteredRooms.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-zinc-500">
                  No rooms found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default RoomSelector;
