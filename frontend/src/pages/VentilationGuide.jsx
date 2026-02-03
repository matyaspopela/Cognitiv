import React from 'react'
import Card from '../components/ui/Card'
import './Dashboard.css'

const VentilationGuide = () => {
    return (
        <div className="dashboard-page">
            <Card elevation={1}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--md3-spacing-12)',
                    color: 'var(--md3-color-text-secondary)',
                    textAlign: 'center',
                    minHeight: '400px'
                }}>
                    <div style={{ marginBottom: 'var(--md3-spacing-4)', opacity: 0.2 }}>
                        <svg
                            width="64"
                            height="64"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
                            <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
                            <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
                        </svg>
                    </div>
                    <h2 style={{
                        fontSize: 'var(--md3-font-size-headline-small)',
                        fontWeight: 'var(--md3-font-weight-medium)',
                        color: 'var(--md3-color-text-primary)',
                        marginBottom: 'var(--md3-spacing-2)'
                    }}>
                        Guide Under Development
                    </h2>
                    <p style={{ maxWidth: '400px', margin: '0 auto' }}>
                        We are currently refining our ventilation recommendations to provide you with the most accurate and helpful guidance.
                    </p>
                </div>
            </Card>
        </div>
    )
}

export default VentilationGuide

