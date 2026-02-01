import React from 'react'
import { Wind, ArrowLeft, Clock, ThermometerSun, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/ui/Card'

const VentilationGuide = () => {
    const navigate = useNavigate()

    return (
        <div className="max-w-4xl mx-auto p-6">
            <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft size={20} />
                <span>Back to Dashboard</span>
            </button>

            <header className="mb-10 text-center">
                <div className="inline-flex p-4 bg-emerald-500/10 rounded-full text-emerald-400 mb-6">
                    <Wind size={48} />
                </div>
                <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Effective Ventilation Guide</h1>
                <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                    Maintaining good air quality is simpler than you think. Follow these best practices to ensure a healthy learning environment.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <Card className="hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 mt-1">
                            <Wind size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">Cross Ventilation</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                Open windows and doors on opposite sides of the room. This creates a pressure difference that flushes out stale air and pulls in fresh air much faster than opening a single window.
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 mt-1">
                            <Clock size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">The 5-Minute Rule</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                You don't need to keep windows open all day. A full air exchange can happen in just 5-10 minutes with effective cross-ventilation. Do this between lessons or during breaks.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            <h2 className="text-2xl font-bold text-white mb-6">When to Ventilate</h2>
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 mb-12">
                <div className="space-y-4">
                    <div className="flex items-center gap-4 text-zinc-300">
                        <AlertTriangle className="text-red-400" size={20} />
                        <span><strong>CO₂ &gt; 1000 ppm:</strong> Brain function starts to decline. Plan a break soon.</span>
                    </div>
                    <div className="flex items-center gap-4 text-zinc-300">
                        <AlertTriangle className="text-red-500" size={20} />
                        <span><strong>CO₂ &gt; 1400 ppm:</strong> Immediate ventilation required. Concentration is significantly impaired.</span>
                    </div>
                    <div className="flex items-center gap-4 text-zinc-300">
                        <ThermometerSun className="text-orange-400" size={20} />
                        <span><strong>High Humidity:</strong> If humidity exceeds 60%, ventilate to prevent mold growth.</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VentilationGuide
