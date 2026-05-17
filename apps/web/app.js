var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var nftsRouter = require('./routes/nfts');
var liquidApiRouter = require('./routes/liquid-api');
var booksRouter = require('./routes/books');
var copiesRouter = require('./routes/copies');
var listingsRouter = require('./routes/listings');
var txRouter = require('./routes/tx');
var walletRouter = require('./routes/wallet');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/nfts', nftsRouter);
app.use('/api/liquid', liquidApiRouter);
app.use('/api/books', booksRouter);
app.use('/api/copies', copiesRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/tx', txRouter);
app.use('/api/wallet', walletRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
