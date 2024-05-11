// If you can, you obviously should.

/**
 * The identity function. Returns its input unmodified.
 */
export function id<A>(value: A): A {
  return value;
}

/**
 * Construct a function which always returns the provided value.
 */
export function constant<A>(value: A): () => A {
  return () => value;
}

/**
 * A nullable value of type `A`.
 */
export class Option<A> {
  private option: A | undefined;

  /**
   * Construct an [[Option]] from a nullable value of `A`.
   */
  constructor(value: A | undefined) {
    this.option = value;
  }

  /**
   * Convert a [[Thenable]] returning `A` into a [[Thenable]] returning an [[Option]] of `A`, or `None` if the [[Thenable]] fails.
   * The new [[Thenable]] always succeeds, reflecting an error condition in the `Option` instead of the failure callback.
   */
  static try<A>(m: Thenable<A>): Thenable<Option<A>> {
    return m.then(Some, constant(None));
  }

  /**
   * In the absence of pattern matching in the language, the `match` function takes two callbacks, one for each possible
   * state of the [[Option]], and calls the one that matches the actual state.
   */
  match<B>(onSome: (value: A) => B, onNone: () => B): B {
    if (this.option === undefined) {
      return onNone();
    } else {
      return onSome(this.option);
    }
  }

  /**
   * Test if the [[Option]] contains a value.
   */
  isSome(): boolean {
    return this.option !== undefined;
  }

  /**
   * Test if the [[Option]] is null.
   */
  isNone(): boolean {
    return this.option === undefined;
  }

  /**
   * Test if the [[Option]] contains a value that's equal to `value`.
   */
  contains(value: A): boolean {
    return this.option === value;
  }

  /**
   * Call the provided function with the contained value if the [[Option]] is non-null.
   */
  ifSome(onSome: (value: A) => void) {
    this.match(onSome, constant({}));
  }

  /**
   * Call the provided function if the [[Option]] is null.
   */
  ifNone(onNone: () => void) {
    this.match(constant({}), onNone);
  }

  /**
   * If the [[Option]] is non-null, call the provided function with the contained value and
   * return a new [[Option]] containing the result of the function, which must be another [[Option]].
   */
  andThen<B>(f: (value: A) => Option<B>): Option<B> {
    return this.match(f, constant(None));
  }

  /**
   * If the [[Option]] is null, call the provided function and return its result, which must be another [[Option]] of `A`.
   */
  orElse(f: () => Option<A>): Option<A> {
    return this.match(Some, f);
  }

  /**
   * If the [[Option]] is non-null, transform its contained value using the provided function.
   */
  map<B>(f: (value: A) => B): Option<B> {
    return this.andThen((v) => Some(f(v)));
  }

  /**
   * If the [[Option]] is non-null, return the provided [[Option]] of `B`, otherwise return [[None]].
   */
  and<B>(option: Option<B>): Option<B> {
    return this.andThen(constant(option));
  }

  /**
   * If the [[Option]] is null, return the provided [[Option]], otherwise return the original [[Option]].
   */
  or(option: Option<A>): Option<A> {
    return this.orElse(constant(option));
  }

  /**
   * Return the value contained in the [[Option]] if it's non-null, or return `defaultValue` otherwise.
   */
  getOr(defaultValue: A): A {
    return this.match(id, constant(defaultValue));
  }

  /**
   * Return the value contained in the [[Option]] if it's non-null, or call the provided function and return its result otherwise.
   */
  getOrElse(f: () => A): A {
    return this.match(id, f);
  }

  /**
   * Convert the [[Option]] into a [[Result]], using the provided `error` value if the [[Option]] is null.
   */
  okOr<E>(error: E): Result<A, E> {
    return this.match(Ok, () => Err(error));
  }

  /**
   * Convert the [[Option]] into a [[Result]], calling the provided function to obtain an error value if the [[Option]] is null.
   */
  okOrElse<E>(f: () => E): Result<A, E> {
    return this.match(Ok, () => Err(f()));
  }

  /**
   * Convert the [[Option]] into a nullable value of `A`.
   */
  unwrap(): A | undefined {
    return this.option;
  }

  /**
   * Convert the [[Option]] into a value of `A`, using the provided default value if the [[Option]] is null.
   */
  unwrapOr(defaultValue: A): A {
    return this.match(id, constant(defaultValue));
  }

  /**
   * Convert the [[Option]] into a value of `A`, calling the provided function to produce a default value if the [[Option]] is null.
   */
  unwrapOrElse(f: () => A): A {
    return this.match(id, f);
  }
}

/**
 * Construct an [[Option]] containing the provided value.
 *
 * ```typescript
 * const option: Option<string> = Some("Hello Joe");
 * ```
 */
export function Some<A>(value: A): Option<A> {
  return new Option(value);
}

/**
 * A null [[Option]].
 *
 * ```typescript
 * const option: Option<string> = None;
 * ```
 */
export const None = new Option<never>(undefined);

/** @internal */
type Ok<A> = { tag: "ok"; value: A };
/** @internal */
type Err<E> = { tag: "err"; value: E };

/**
 * A value which can be of either type `A` or type `E`.
 *
 * This is normally used as a return value for operations which can fail: `E` is short for `Error`.
 */
export class Result<A, E> {
  private result: Ok<A> | Err<E>;

  constructor(value: Ok<A> | Err<E>) {
    this.result = value;
  }

  /**
   * Convert a [[Thenable]] returning `A` into a [[Thenable]] returning a [[Result]] of either `A` or the `Error` type.
   * The new [[Thenable]] always succeeds, reflecting an error condition in the `Result` instead of the failure callback.
   */
  static try<A>(m: Thenable<A>): Thenable<Result<A, Error>> {
    return m.then(Ok, Err);
  }

  /**
   * In the absence of pattern matching in the language, the `match` function takes two callbacks, one for each possible
   * state of the [[Result]], and calls the one that matches the actual state.
   */
  match<B>(onOk: (value: A) => B, onErr: (value: E) => B): B {
    if (this.result.tag === "ok") {
      return onOk(this.result.value);
    } else {
      return onErr(this.result.value);
    }
  }

  isOk(): boolean {
    return this.result.tag === "ok";
  }

  isErr(): boolean {
    return this.result.tag === "err";
  }

  ifOk(onOk: (value: A) => void) {
    this.match(onOk, constant({}));
  }

  ifErr(onErr: (value: E) => void) {
    this.match(constant({}), onErr);
  }

  andThen<B>(f: (value: A) => Result<B, E>): Result<B, E> {
    return this.match(f, Err);
  }

  orElse<F>(f: (value: E) => Result<A, F>): Result<A, F> {
    return this.match(Ok, f);
  }

  map<B>(f: (value: A) => B): Result<B, E> {
    return this.andThen((value) => Ok(f(value)));
  }

  mapErr<F>(f: (value: E) => F): Result<A, F> {
    return this.orElse((value) => Err(f(value)));
  }

  and<B>(result: Result<B, E>): Result<B, E> {
    return this.andThen(constant(result));
  }

  or<F>(result: Result<A, F>): Result<A, F> {
    return this.orElse(constant(result));
  }

  getOr(defaultValue: A): A {
    return this.match(id, constant(defaultValue));
  }

  getOrElse(f: () => A): A {
    return this.match(id, f);
  }

  /**
   * Converts a [[Result]] into a nullable value of `A`, discarding any error value and returning `undefined` in place of the error.
   */
  unwrap(): A | undefined {
    return this.result.tag === "ok" ? this.result.value : undefined;
  }

  /**
   * Converts a [[Result]] into a nullable value of `E`, discarding any success value and returning `undefined` in place of the `A` value.
   */
  unwrapErr(): E | undefined {
    return this.result.tag === "err" ? this.result.value : undefined;
  }
}

/**
 * Construct a [[Result]] with a success value of `A`.
 *
 * ```typescript
 * const systemWorking: Result<string> = Ok("Seems to be!");
 * ```
 */
export function Ok<A = never, E = never>(value: A): Result<A, E> {
  return new Result<A, E>({ tag: "ok", value });
}

/**
 * Construct a [[Result]] with an error value of `E`.
 *
 * ```typescript
 * const systemWorking: Result<string> = Err("System down!");
 * ```
 */
export function Err<A = never, E = never>(value: E): Result<A, E> {
  return new Result<A, E>({ tag: "err", value });
}
