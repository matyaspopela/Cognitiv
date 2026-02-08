import { useMemo } from 'react'

/**
 * Custom hook to analyze device list and generate alerts
 * @param {Array} devices - Array of device objects with current_readings and last_seen
 * @returns {Object} { summary, alerts }
 */
const useDeviceAlerts = (devices) => {
    const { summary, alerts } = useMemo(() => {
        if (!devices || !Array.isArray(devices)) {
            return { summary: { offline: 0, highCo2: 0, lowCo2: 0, lowVoltage: 0, totalAlerts: 0 }, alerts: [] }
        }

        const alertsList = []
        let offlineCount = 0
        let highCo2Count = 0
        let lowCo2Count = 0
        let lowVoltageCount = 0

        const now = new Date()

        devices.forEach((device) => {
            const deviceId = device.mac_address || device.device_id || 'Unknown'
            const readings = device.current_readings || {}

            // Check CO2 levels
            if (readings.co2 != null) {
                if (readings.co2 > 1500) {
                    highCo2Count++
                    alertsList.push({
                        deviceId,
                        deviceName: device.display_name || deviceId,
                        type: 'co2_critical',
                        message: `Critical CO2: ${Math.round(readings.co2)} ppm`,
                        severity: 'error',
                        value: readings.co2
                    })
                } else if (readings.co2 < 400) {
                    lowCo2Count++
                    alertsList.push({
                        deviceId,
                        deviceName: device.display_name || deviceId,
                        type: 'co2_low',
                        message: `Low CO2 (Sensor Issue?): ${Math.round(readings.co2)} ppm`,
                        severity: 'warning',
                        value: readings.co2
                    })
                }
            }

            // Check voltage
            if (readings.voltage != null && readings.voltage < 3.5) {
                lowVoltageCount++
                alertsList.push({
                    deviceId,
                    deviceName: device.display_name || deviceId,
                    type: 'voltage_low',
                    message: `Low Voltage: ${readings.voltage.toFixed(2)}V`,
                    severity: 'warning',
                    value: readings.voltage
                })
            }

            // Check inactivity (last_seen > 1 hour)
            if (device.last_seen) {
                try {
                    const lastSeenDate = new Date(device.last_seen)
                    const minutesAgo = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60)

                    if (minutesAgo > 60) {
                        offlineCount++
                        alertsList.push({
                            deviceId,
                            deviceName: device.display_name || deviceId,
                            type: 'offline',
                            message: `Offline for ${Math.round(minutesAgo / 60)}h`,
                            severity: 'error',
                            value: minutesAgo
                        })
                    }
                } catch (error) {
                    // Invalid date, skip
                }
            }
        })

        const totalAlerts = offlineCount + highCo2Count + lowCo2Count + lowVoltageCount

        return {
            summary: {
                offline: offlineCount,
                highCo2: highCo2Count,
                lowCo2: lowCo2Count,
                lowVoltage: lowVoltageCount,
                totalAlerts
            },
            alerts: alertsList
        }
    }, [devices])

    return { summary, alerts }
}

export default useDeviceAlerts
