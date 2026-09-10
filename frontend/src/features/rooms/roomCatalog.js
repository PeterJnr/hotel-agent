export const roomPresentation = {
  STANDARD: {
    label: "The Standard", eyebrow: "Quiet comfort",
    image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1400&q=88",
    gallery: ["https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1600&q=88", "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1000&q=85", "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?auto=format&fit=crop&w=1000&q=85"],
    amenities: ["King bed", "Rain shower", "City outlook", "High-speed Wi-Fi", "Breakfast available", "Solacii AI concierge"],
  },
  EXECUTIVE: {
    label: "The Executive", eyebrow: "Room to focus",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=88",
    gallery: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1600&q=88", "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=85", "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85"],
    amenities: ["King bed", "Dedicated workspace", "Lounge seating", "Premium minibar", "High-speed Wi-Fi", "Solacii AI concierge"],
  },
  SUITE: {
    label: "The Solacii Suite", eyebrow: "Our signature stay",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=88",
    gallery: ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=88", "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=85", "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1000&q=85"],
    amenities: ["Separate living room", "Super king bed", "Soaking bath", "Personal bar", "Priority service", "Solacii AI concierge"],
  },
};

export function presentRoomType(roomType, images = []) {
  const presentation = roomPresentation[roomType.name] || roomPresentation.STANDARD;
  const storedImages = images.length ? images.map(({ url }) => url) : roomType.images?.map(({ url }) => url) || [];
  return { ...roomType, ...presentation, gallery: storedImages.length ? storedImages : presentation.gallery, image: storedImages[0] || presentation.image };
}

export function formatNaira(value) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(value));
}
