// Realistic vehicle state generator for 100K+ vehicles
class VehicleModel {
  constructor(vin, index) {
    this.vin = vin;
    this.index = index;
    // Split into cohorts: index <= 12000 is OTA treatment cohort (v4.7), remainder is v4.6
    this.firmware = index <= 12000 ? '4.7' : '4.6';
    this.otaCampaign = index <= 12000 ? 'CAMPAIGN-OTA-47' : null;

    // Initial physical state
    this.seq = 1000 + Math.floor(Math.random() * 5000);
    this.speedKmh = 45.0 + (Math.sin(index) * 20.0);
    this.batterySoc = 85.0 - (index % 60);
    this.odometerKm = 12000.0 + (index * 1.5);

    // Initial GPS location (centered around Chicago metro area)
    this.lat = 41.8781 + ((index % 100) * 0.005) - 0.25;
    this.lon = -87.6298 + (((index / 100) % 100) * 0.005) - 0.25;
    this.heading = (index * 37) % 360;

    this.lastTimestamp = Date.now();
  }

  tick(dtSec = 1.0) {
    this.seq += 1;
    this.lastTimestamp += dtSec * 1000;

    // Realistic speed fluctuation
    const accel = (Math.random() - 0.49) * 2.0; // gentle acceleration/deceleration
    this.speedKmh = Math.max(0.0, Math.min(125.0, this.speedKmh + accel));

    // Distance covered in dtSec
    const distKm = (this.speedKmh / 3600.0) * dtSec;
    this.odometerKm += distKm;

    // Advance GPS along heading
    const rad = (this.heading * Math.PI) / 180.0;
    const dLat = (distKm / 111.0) * Math.cos(rad);
    const dLon = (distKm / (111.0 * Math.cos(this.lat * Math.PI / 180.0))) * Math.sin(rad);
    this.lat += dLat;
    this.lon += dLon;

    // Realistic battery discharge (approx 0.02% per km at 50 km/h)
    const discharge = distKm * 0.025 + 0.001;
    this.batterySoc = Math.max(5.0, this.batterySoc - discharge);

    // Return canonical event with cross-signal context
    const context = {
      speed_kmh: Number(this.speedKmh.toFixed(1)),
      odometer_km: Number(this.odometerKm.toFixed(3)),
      gps: {
        lat: Number(this.lat.toFixed(6)),
        lon: Number(this.lon.toFixed(6)),
      },
      battery_soc: Number(this.batterySoc.toFixed(2)),
    };

    return {
      vin: this.vin,
      seq: this.seq,
      signal: 'battery_soc',
      value: Number(this.batterySoc.toFixed(2)),
      eventTime: new Date(this.lastTimestamp).toISOString(),
      provenance: {
        oem: 'DEMO_OEM',
        firmware: this.firmware,
        otaCampaign: this.otaCampaign,
        sourceEcu: 'BMS_PRIMARY',
      },
      context,
      // Backwards-compatible signals map
      signals: {
        speedKmh: context.speed_kmh,
        batterySocPct: context.battery_soc,
        odometerKm: context.odometer_km,
        location: context.gps,
      },
    };
  }

  generateSignalEvent(signalName = 'battery_soc') {
    const raw = this.tick(1.0);
    if (signalName === 'speed_kmh') {
      return {
        ...raw,
        signal: 'speed_kmh',
        value: raw.context.speed_kmh,
        provenance: { ...raw.provenance, sourceEcu: 'ESP_WHEEL_SPEED' },
      };
    }
    if (signalName === 'location_gps') {
      return {
        ...raw,
        signal: 'location_gps',
        value: raw.context.gps,
        provenance: { ...raw.provenance, sourceEcu: 'TCU_GNSS' },
      };
    }
    return raw;
  }
}

module.exports = VehicleModel;
