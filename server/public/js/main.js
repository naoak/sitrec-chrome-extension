$(function() {
  echo.init({
    offset: 100,
    debounce: false,
    unload: true
  });
  $('.album').magnificPopup({
    delegate: '.frame-link',
    type: 'image'
  });
});
