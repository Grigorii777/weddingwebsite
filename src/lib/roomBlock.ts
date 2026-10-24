// Default RSVP-confirmation room-block message. Shared between the admin editor
// (pre-fills the textarea so it's visible/overwritable) and the public RSVP form
// (fallback when nothing is saved). Supports {names}, {hotel}, and {book} tokens.
// Plain module with no server deps so it's safe to import in client components.
export const DEFAULT_ROOM_BLOCK_MESSAGE =
    "Нужно остановиться на ночь? {names} зарезервировали номера в {hotel} для наших гостей. Нажмите {book}, чтобы забронировать номер. Вы также можете связаться с отелем напрямую и выбрать удобный вариант проживания. ♥";
