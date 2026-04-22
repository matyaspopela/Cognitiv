import React from 'react'
import Card from '../components/ui/Card'
import { Wind } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'

const VentilationGuide = () => {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader />
            <Card className="flex flex-col items-center justify-center py-20 text-center min-h-[400px]">
                <div className="mb-6 text-stone-200">
                    <Wind size={64} strokeWidth={1.2} />
                </div>
                
                <h2 className="text-xl font-bold text-stone-900 mb-2 uppercase tracking-tight">
                    Guide Under Development
                </h2>
                
                <p className="text-stone-500 max-w-md mx-auto text-sm leading-relaxed">
                    We are currently refining our ventilation recommendations to provide you with the most accurate and helpful guidance for maintaining optimal classroom air quality.
                </p>
                
                <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl px-4">
                    <div className="p-4 rounded-lg bg-stone-50 border border-stone-100">
                        <div className="text-[10px] font-bold text-stone-400 uppercase mb-1">Standard</div>
                        <div className="text-xs text-stone-600 font-medium">Regular intervals</div>
                    </div>
                    <div className="p-4 rounded-lg bg-stone-50 border border-stone-100">
                        <div className="text-[10px] font-bold text-stone-400 uppercase mb-1">Cross-flow</div>
                        <div className="text-xs text-stone-600 font-medium">Multiple openings</div>
                    </div>
                    <div className="p-4 rounded-lg bg-stone-50 border border-stone-100">
                        <div className="text-[10px] font-bold text-stone-400 uppercase mb-1">Purification</div>
                        <div className="text-xs text-stone-600 font-medium">Filtration systems</div>
                    </div>
                </div>
            </Card>
        </div>
    )
}

export default VentilationGuide
