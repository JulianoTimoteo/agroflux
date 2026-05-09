// Desregistra todos os Service Workers
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  console.log('Service Workers desregistrados');
  // Recarrega para garantir
  location.reload();
});
