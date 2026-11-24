import { api } from '../lib/api';

/** An onboarding service row: price in dollars as typed; id when it already exists. */
export type Service = { id?: string; name: string; price: number; duration: number };

export const addService = (setFormData: React.Dispatch<React.SetStateAction<any>>) => {
  setFormData((prev: any) => ({
    ...prev,
    services: [...prev.services, { name: '', price: 0, duration: 30 }],
  }));
};

export const removeService = (index: number, setFormData: React.Dispatch<React.SetStateAction<any>>) => {
  setFormData((prev: any) => ({
    ...prev,
    services: prev.services.filter((_: any, i: number) => i !== index),
  }));
};

export const updateService = (
  index: number,
  field: string,
  value: string | number,
  setFormData: React.Dispatch<React.SetStateAction<any>>
) => {
  setFormData((prev: any) => ({
    ...prev,
    services: prev.services.map((service: Service, i: number) =>
      i === index ? { ...service, [field]: value } : service
    ),
  }));
};

export const validateServices = (services: Service[]) => {
  const errors: Record<string, string> = {};
  if (services.length === 0) {
    errors.services = 'At least one service is required';
  } else {
    services.forEach((service, index) => {
      if (!service.name.trim()) {
        errors[`services.${index}.name`] = 'Service name is required';
      }
      if (!service.price || Number(service.price) <= 0) {
        errors[`services.${index}.price`] = 'Valid price is required';
      }
      if (!service.duration || Number(service.duration) < 5 || Number(service.duration) > 480) {
        errors[`services.${index}.duration`] = 'Duration must be between 5 and 480 minutes';
      }
    });
  }
  return errors;
};

/**
 * Saves the onboarding services through the API: updates existing ones, creates
 * new ones and removes active services no longer listed (the server deactivates
 * a service that bookings reference instead of deleting it).
 */
export const syncServices = async (services: Service[]): Promise<Service[]> => {
  const { services: existing } = await api.services.list();
  const keep = new Set(services.map((s) => s.id).filter(Boolean));
  for (const service of services) {
    const body = {
      name: service.name.trim(),
      priceCents: Math.round(Number(service.price) * 100),
      durationMinutes: Math.round(Number(service.duration)),
    };
    if (service.id) await api.services.update(service.id, { ...body, isActive: true });
    else await api.services.create(body);
  }
  for (const old of existing) {
    if (old.is_active && !keep.has(old.id)) await api.services.remove(old.id);
  }
  // Return the saved rows (with ids) so a second save updates instead of duplicating.
  const { services: saved } = await api.services.list();
  return saved
    .filter((s) => s.is_active)
    .map((s) => ({ id: s.id, name: s.name, price: s.price_cents / 100, duration: s.duration_minutes }));
};

export default { addService, removeService, updateService, validateServices, syncServices };

