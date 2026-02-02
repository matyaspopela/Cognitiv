import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { datalabService } from '../../../services/datalabService';

const AdvancedFilters = ({ filters, onChange }) => {
    const [availableTeachers, setAvailableTeachers] = useState([]);
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch filter options from API
    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const response = await datalabService.getFilterOptions();
                const data = response.data.data;

                setAvailableTeachers(data.teachers || []);
                setAvailableSubjects(data.subjects || []);
                setAvailableClasses(data.classes || []);
            } catch (error) {
                console.error('Failed to fetch filter options:', error);
                // Fallback to empty arrays
                setAvailableTeachers([]);
                setAvailableSubjects([]);
                setAvailableClasses([]);
            } finally {
                setLoading(false);
            }
        };

        fetchFilterOptions();
    }, []);

    const handleFilterChange = (key, value) => {
        onChange({ ...filters, [key]: value });
    };

    const clearFilter = (key) => {
        const newFilters = { ...filters };
        delete newFilters[key];
        onChange(newFilters);
    };

    const activeFilterCount = [
        filters.teacher,
        filters.subject,
        filters.class_name,
        filters.lesson_of_day
    ].filter(Boolean).length;

    return (
        <div className="w-full space-y-6">
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold tracking-[0.05em] uppercase text-zinc-400">
                    Lesson Filters
                </label>
                {activeFilterCount > 0 && (
                    <button
                        onClick={() => onChange({})}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Filter Controls */}
            <div className="space-y-4">
                {/* Teacher Filter */}
                <div className="relative group">
                    <select
                        value={filters.teacher || ''}
                        onChange={(e) => handleFilterChange('teacher', e.target.value || undefined)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-zinc-700 rounded-lg bg-zinc-900/30 text-zinc-200 focus:border-emerald-500 outline-none appearance-none cursor-pointer hover:border-zinc-500 transition-colors"
                    >
                        <option value="" className="text-zinc-500 dark:text-zinc-400">All Teachers</option>
                        {availableTeachers.map(teacher => (
                            <option key={teacher} value={teacher} className="dark:bg-zinc-900">{teacher}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>

                {/* Subject Filter */}
                <div className="relative group">
                    <select
                        value={filters.subject || ''}
                        onChange={(e) => handleFilterChange('subject', e.target.value || undefined)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-zinc-700 rounded-lg bg-zinc-900/30 text-zinc-200 focus:border-emerald-500 outline-none appearance-none cursor-pointer hover:border-zinc-500 transition-colors"
                    >
                        <option value="" className="text-zinc-500 dark:text-zinc-400">All Subjects</option>
                        {availableSubjects.map(subject => (
                            <option key={subject} value={subject} className="dark:bg-zinc-900">{subject}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>

                {/* Class Filter */}
                <div className="relative group">
                    <select
                        value={filters.class_name || ''}
                        onChange={(e) => handleFilterChange('class_name', e.target.value || undefined)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-zinc-700 rounded-lg bg-zinc-900/30 text-zinc-200 focus:border-emerald-500 outline-none appearance-none cursor-pointer hover:border-zinc-500 transition-colors"
                    >
                        <option value="" className="text-zinc-500 dark:text-zinc-400">All Classes</option>
                        {availableClasses.map(className => (
                            <option key={className} value={className} className="dark:bg-zinc-900">{className}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>

                {/* Lesson of Day Filter */}
                <div className="relative group">
                    <select
                        value={filters.lesson_of_day || ''}
                        onChange={(e) => handleFilterChange('lesson_of_day', e.target.value || undefined)}
                        className="w-full pl-3 pr-8 py-2 text-sm border border-zinc-700 rounded-lg bg-zinc-900/30 text-zinc-200 focus:border-emerald-500 outline-none appearance-none cursor-pointer hover:border-zinc-500 transition-colors"
                    >
                        <option value="" className="text-zinc-500 dark:text-zinc-400">All Periods</option>
                        <option value="1" className="dark:bg-zinc-900">Period 1 (08:00-09:00)</option>
                        <option value="2" className="dark:bg-zinc-900">Period 2 (09:00-10:00)</option>
                        <option value="3" className="dark:bg-zinc-900">Period 3 (10:00-11:00)</option>
                        <option value="4" className="dark:bg-zinc-900">Period 4 (11:00-12:00)</option>
                        <option value="5" className="dark:bg-zinc-900">Period 5 (13:00-14:00)</option>
                        <option value="6" className="dark:bg-zinc-900">Period 6 (14:00-15:00)</option>
                        <option value="7" className="dark:bg-zinc-900">Period 7 (15:00-16:00)</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>
            </div>
        </div>
    );
};

export default AdvancedFilters;
