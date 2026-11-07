// Milestone prize catalogue. Details are taken from the supplier images supplied for the programme.
// The exact models and availability must be confirmed with each supplier before any prize is announced.
export interface Prize {
  id: string;
  name: string;
  model: string;
  image: string;
  description: string;
  details: string[];
  supplierNote: string;
}

export const PRIZES: Prize[] = [
  {
    id: 'car',
    name: 'Car',
    model: 'Maruti Suzuki Swift',
    image: '/prizes/car-maruti-suzuki-swift.jpg',
    description: 'A five-door hatchback in red with a black roof, shown with the Swift badge.',
    details: ['Five-door hatchback', 'Red body with black roof', 'Variant and fuel type confirmed by supplier'],
    supplierNote: 'Variant, colour availability and delivery terms to be confirmed.',
  },
  {
    id: 'bike',
    name: 'Bike',
    model: 'Bajaj Pulsar',
    image: '/prizes/bike-bajaj-pulsar.jpg',
    description: 'A naked street motorcycle in black and red with a Pulsar badge on the tank.',
    details: ['Naked street motorcycle', 'Black and red colour', 'Variant and engine size confirmed by supplier'],
    supplierNote: 'Variant, registration and delivery terms to be confirmed.',
  },
  {
    id: 'iphone',
    name: 'iPhone',
    model: 'Apple iPhone Duo',
    image: '/prizes/iphone-duo.jpg',
    description: 'A foldable iPhone with a dual-camera system and a large inner display, shown in navy and white.',
    details: ['Foldable display', 'Dual camera system', 'Apple A20 Pro chip (as stated in the supplier images)'],
    supplierNote: 'Model name, storage and availability to be confirmed before it is offered.',
  },
];
