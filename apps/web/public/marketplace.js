(function() {
  function formBody(form) {
    var data = new FormData(form);
    var body = {};

    data.forEach(function(value, key) {
      if (value === '') return;
      body[key] = value;
    });

    return body;
  }

  function numericFields(body, fields) {
    fields.forEach(function(field) {
      if (body[field] !== undefined) {
        body[field] = Number(body[field]);
      }
    });
    return body;
  }

  function showResult(form, payload, failed) {
    var result = form.parentElement.querySelector('.form-result');
    if (!result) return;

    result.hidden = false;
    result.classList.toggle('form-result--error', Boolean(failed));
    result.textContent = JSON.stringify(payload, null, 2);
  }

  function postJson(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }).then(function(response) {
      return response.json().then(function(payload) {
        if (!response.ok) {
          var error = new Error(payload.error || 'Request failed');
          error.payload = payload;
          throw error;
        }

        return payload;
      });
    });
  }

  function wire(selector, buildRequest) {
    document.querySelectorAll(selector).forEach(function(form) {
      form.addEventListener('submit', function(event) {
        event.preventDefault();
        showResult(form, { status: 'Preparing...' });

        var request = buildRequest(form);

        postJson(request.url, request.body)
          .then(function(payload) {
            showResult(form, payload);
          })
          .catch(function(error) {
            showResult(form, error.payload || { error: error.message }, true);
          });
      });
    });
  }

  wire('.js-primary-buy', function(form) {
    return {
      url: '/api/books/' + form.dataset.bookId + '/buy/prepare',
      body: formBody(form)
    };
  });

  wire('.js-resale-buy', function(form) {
    var body = numericFields(formBody(form), ['feeAmount']);
    body.mode = 'simplicity';
    body.createSimplicityPset = true;

    return {
      url: '/api/listings/' + form.dataset.listingId + '/buy/prepare',
      body: body
    };
  });

  wire('.js-list-copy', function(form) {
    return {
      url: '/api/copies/' + form.dataset.copyId + '/list',
      body: numericFields(formBody(form), ['price'])
    };
  });
})();
