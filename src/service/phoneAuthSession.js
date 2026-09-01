// phoneAuthSession.js
let currentConfirmation = null;

export const setPhoneConfirmation = (confirmation) => {
  currentConfirmation = confirmation;
};

export const getPhoneConfirmation = () => currentConfirmation;

export const clearPhoneConfirmation = () => {
  currentConfirmation = null;
};