// If you can, you obviously should.

export function id<A>(value: A): A {
    return value;
}

export function constant<A>(value: A): () => A {
    return () => value;
}

// Option<A>

export class Option<A> {
    option: A | undefined;

    constructor(value: A | undefined) {
        this.option = value;
    }

    static try<A>(m: Thenable<A>): Thenable<Option<A>> {
        return m.then(Some, constant(None));
    }

    match<B>(onSome: (value: A) => B, onNone: () => B): B {
        if (this.option === undefined) {
            return onNone();
        } else {
            return onSome(this.option);
        }
    }

    isSome(): boolean {
        return this.option !== undefined;
    }

    isNone(): boolean {
        return this.option === undefined;
    }

    ifSome(onSome: (value: A) => void) {
        this.match(onSome, constant({}));
    }

    ifNone(onNone: () => void) {
        this.match(constant({}), onNone);
    }

    andThen<B>(f: (value: A) => Option<B>): Option<B> {
        return this.match(f, constant(None));
    }

    orElse(f: () => Option<A>): Option<A> {
        return this.match(Some, f);
    }

    map<B>(f: (value: A) => B): Option<B> {
        return this.andThen((v) => Some(f(v)));
    }

    and<B>(option: Option<B>): Option<B> {
        return this.andThen(constant(option));
    }

    or(option: Option<A>): Option<A> {
        return this.orElse(constant(option));
    }

    getOr(defaultValue: A): A {
        return this.match(id, constant(defaultValue));
    }

    getOrElse(f: () => A): A {
        return this.match(id, f);
    }

    okOr<E>(error: E): Result<A, E> {
        return this.match(Ok, () => Err(error));
    }

    okOrElse<E>(f: () => E): Result<A, E> {
        return this.match(Ok, () => Err(f()));
    }

    unwrap(): A | undefined {
        return this.option;
    }
}

export function Some<A>(value: A): Option<A> {
    return new Option(value);
}

export const None = new Option<never>(undefined);

// Result<A, E>

type Ok<A> = { tag: "ok"; value: A };
type Err<E> = { tag: "err"; value: E };

export class Result<A, E> {
    result: Ok<A> | Err<E>;

    constructor(value: Ok<A> | Err<E>) {
        this.result = value;
    }

    static try<A>(m: Thenable<A>): Thenable<Result<A, Error>> {
        return m.then(Ok, Err);
    }

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

    unwrap(): A | undefined {
        return this.result.tag === "ok" ? this.result.value : undefined;
    }

    unwrapErr(): E | undefined {
        return this.result.tag === "err" ? this.result.value : undefined;
    }
}

export function Ok<A = never, E = never>(value: A): Result<A, E> {
    return new Result({ tag: "ok", value });
}

export function Err<A = never, E = never>(value: E): Result<A, E> {
    return new Result({ tag: "err", value });
}
