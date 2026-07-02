import { calculateSurcharges } from '../src/utils/surchargeCalculator';

const settings = {
  night_surcharge_start_time: '22:00:00',
  night_surcharge_end_time: '06:00:00',
  night_surcharge_rate: 25,
  sunday_surcharge_rate: 50,
  holiday_surcharge_rate: 100
};

console.log('22:30 to 00:00:', calculateSurcharges('2026-01-15', '22:30:00', '00:00:00', 0, settings));
console.log('22:30 to 24:00:', calculateSurcharges('2026-01-15', '22:30:00', '24:00:00', 0, settings));
