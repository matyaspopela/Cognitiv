import React, { useState, useEffect } from 'react';
import { Check, Search } from 'lucide-react';
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
    <div className="relative w-full mb-4">
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        Select Rooms
      </label>
      {error && (
        <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="relative">
        <div
          className="w-full border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 p-2 min-h-[42px] cursor-pointer flex flex-wrap gap-1 items-center"
          onClick={() => setIsOpen(!isOpen)}
        >
          {loading ? (
            <span className="text-zinc-500 text-sm">Loading rooms...</span>
          ) : selectedRooms.length === 0 ? (
            <span className="text-zinc-500 text-sm">Select rooms...</span>
          ) : (
            selectedRooms.map((id) => {
              const room = rooms.find((r) => r.id === id);
              return (
                <span
                  key={id}
                  className="bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs px-2 py-1 rounded-full flex items-center gap-1"
                >
                  {room ? (room.name || room.id) : id}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRoom(id);
                    }}
                    className="hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              );
            })
          )}
        </div>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
            <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-800">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-md bg-zinc-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selectAll();
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline w-full text-left"
              >
                {selectedRooms.length === rooms.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="py-1">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => toggleRoom(room.id)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700 cursor-pointer text-sm text-zinc-700 dark:text-zinc-200"
                >
                  <span>{room.name || room.id}</span>
                  {selectedRooms.includes(room.id) && (
                    <Check className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  )}
                </div>
              ))}
              {filteredRooms.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-zinc-500">
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
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default RoomSelector;
