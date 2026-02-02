import React from 'react';
import { ReferenceArea } from 'recharts';

/**
 * MetadataOverlay Component
 * 
 * Renders vertical shaded regions on charts to show lesson/subject periods.
 * Each subject gets a distinct color tint for visual identification.
 * 
 * @param {Object} lesson - Lesson metadata { subject, start_time, end_time, teacher }
 * @param {number} index - Index for key generation
 */

// Subject color palette - subtle tints that don't overpower data
const SUBJECT_COLORS = {
    Math: 'rgba(59, 130, 246, 0.1)',       // Blue tint
    Biology: 'rgba(34, 197, 94, 0.1)',      // Green tint
    History: 'rgba(251, 146, 60, 0.1)',     // Orange tint
    Chemistry: 'rgba(168, 85, 247, 0.1)',   // Purple tint
    Physics: 'rgba(236, 72, 153, 0.1)',     // Pink tint
    English: 'rgba(14, 165, 233, 0.1)',     // Cyan tint
    Geography: 'rgba(132, 204, 22, 0.1)',   // Lime tint
    Art: 'rgba(244, 114, 182, 0.1)',        // Rose tint
    Music: 'rgba(192, 132, 252, 0.1)',      // Violet tint
    PE: 'rgba(251, 191, 36, 0.1)',          // Amber tint
};

const DEFAULT_COLOR = 'rgba(156, 163, 175, 0.05)'; // Neutral gray

const MetadataOverlay = ({ lesson, index }) => {
    const { subject, start_time, end_time, teacher } = lesson;

    // Get color for this subject
    const fillColor = SUBJECT_COLORS[subject] || DEFAULT_COLOR;

    return (
        <ReferenceArea
            x1={start_time}
            x2={end_time}
            fill={fillColor}
            fillOpacity={1}
            ifOverflow="extendDomain"
            label={{
                value: subject,
                position: 'insideTopLeft',
                fill: '#9CA3AF',
                fontSize: 10,
                fontWeight: 500,
                offset: 5,
            }}
        />
    );
};

/**
 * MetadataOverlayGroup Component
 * 
 * Renders multiple metadata overlays from lesson data.
 * Handles filtering and rendering of all lesson periods.
 * 
 * @param {Array} lessons - Array of lesson objects
 * @param {boolean} visible - Whether overlays should be rendered
 */
export const MetadataOverlayGroup = ({ lessons = [], visible = false }) => {
    if (!visible || !lessons || lessons.length === 0) {
        return null;
    }

    return (
        <>
            {lessons.map((lesson, index) => (
                <MetadataOverlay
                    key={`overlay-${index}-${lesson.start_time}`}
                    lesson={lesson}
                    index={index}
                />
            ))}
        </>
    );
};

export default MetadataOverlay;
