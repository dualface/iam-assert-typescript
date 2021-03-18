/**
 * 断言函数
 *
 * @param condition
 * @param message
 */
export function assertBoolean(
    condition: boolean,
    message?: string
): asserts condition {
    if (condition) return;
    throw new Error(message);
}

/**
 * 断言是非空值
 *
 * @param condition
 * @param message
 */
export function assertValue(
    condition: any,
    message?: string
): asserts condition {
    if (condition !== undefined && condition !== null) return;
    throw new Error(message);
}

/**
 * 断言是非空值或非 false
 *
 * @param condition
 * @param message
 */
export function assert(condition: any, message?: string): asserts condition {
    if (condition !== false && condition !== undefined && condition !== null)
        return;
    throw new Error(message);
}

/**
 * 确认是否是枚举类型
 *
 * @param val
 * @param enumType
 */
export function isEnum(
    val: string | number,
    enumType: NumericEnum | StringEnum
): boolean {
    const t = typeof enumType[val];
    return t === "string" || t === "number";
}

/**
 * 验证枚举类型
 *
 * @param val
 * @param enumType
 */
export function mustEnum(
    val: string | number,
    enumType: NumericEnum | StringEnum
) {
    if (!isEnum(val, enumType)) {
        throw new TypeError(`expected is ${enumType}, actual is ${val}`);
    }
}

/**
 * 检查枚举类型
 *
 * @param val
 * @param enumType
 */
export function checkEnum(
    val: string | number,
    enumType: NumericEnum | StringEnum
): [boolean, string?] {
    if (!isEnum(val, enumType)) {
        return [false, `expected is ${enumType}, actual is ${val}`];
    } else {
        return [true];
    }
}

/**
 * 检查混合类型
 *
 * type 参数可以指定为基本类型，或者是 Array/Map/Set 为容器的基本类型。
 *
 * check 可以是枚举或者检查函数。
 *
 * @param val
 * @param type
 * @param check
 */
export function checkMixed(
    val: any,
    type: string,
    check?: NumericEnum | StringEnum | CheckTypeFunction
): [boolean, string?] {
    // 如果类型最后一个字符为 ?，表示可选
    if (type.charCodeAt(type.length - 1) === 63) {
        if (typeof val === "undefined" || val === null) {
            return [true];
        }
        type = type.substr(0, type.length - 1);
    }

    const [isContainer, containerType, elementType] = fetchContainerType(type);

    if (isContainer) {
        // 容器类型
        assert(
            containerType,
            `checkMixed(): not set containerType for type '${type}'`
        );
        assert(
            elementType,
            `checkMixed(): not set elementType for type '${type}'`
        );
        switch (containerType.toLowerCase()) {
            case "array":
            case "map":
            case "set":
                return checkIterables(val, elementType, check);

            default:
                return [false, `unsupported container type ${containerType}`];
        }
    }

    // 非容器类型
    if (typeof check === "function") {
        // 自定义类型
        if (!check(val)) {
            return [false, `expected is ${type}`];
        }
        return [true];
    }

    if (check) {
        // 枚举
        return checkEnum(val, check);
    }

    // 基本类型
    if (type === "string") {
        return [true];
    } else if (typeof val !== type) {
        return [false, `expected is ${type}, actual is ${typeof val}`];
    }
    return [true];
}

/**
 * 检查可迭代类型
 *
 * @param val
 * @param type
 * @param check
 */
export function checkIterables(
    val: any,
    type: string,
    check?: NumericEnum | StringEnum | CheckTypeFunction
): [boolean, string?] {
    if (!Array.isArray(val) && typeof val !== "object") {
        return [false, "is not iterables type"];
    }

    if (typeof check === "function") {
        // 自定义类型
        for (const i in val) {
            if (!check(val[i])) {
                return [false, `[${i}] expected is ${type}`];
            }
        }
        return [true];
    }

    if (check) {
        // 枚举
        for (const i in val) {
            if (isEnum(val[i], check)) {
                continue;
            }
            return [false, `[${i}] expected is ${type}, actual is ${val[i]}`];
        }
        return [true];
    }

    // 基本类型
    for (const i in val) {
        const actual = typeof val[i];
        if (actual !== type) {
            return [false, `[${i}] expected is ${type}, actual is ${actual}`];
        }
    }
    return [true];
}

/**
 * 检查可迭代类型并进行断言
 *
 * @param val
 * @param type
 * @param check
 * @param message
 */
export function assertIterables(
    val: any,
    type: string,
    check?: NumericEnum | StringEnum | CheckTypeFunction,
    message?: string
): asserts val {
    const [ok, err] = checkIterables(val, type, check);
    if (!ok) {
        throw new TypeError(
            message ?? `assertIterables(): assert failed, ${err}`
        );
    }
}

/**
 * 根据规则表检查字典
 *
 * @param dict
 * @param rules
 */
export function checkDictionary(
    dict: any,
    rules: CheckRules
): [boolean, string?] {
    if (typeof dict !== "object") {
        return [false, "is not object"];
    }

    for (const name in rules) {
        const rule = rules[name];

        let ok: boolean;
        let err: string | undefined;

        if (typeof rule === "string") {
            [ok, err] = checkMixed(dict[name], rule);
            if (!ok) {
                err = `${name} ${err}`;
            }
        } else if (isCheckTypeStruct(rule)) {
            [ok, err] = checkMixed(dict[name], rule.type, rule.check);
            if (!ok) {
                err = `${name} ${err}`;
            }
        } else {
            throw new TypeError(`rule '${name}' is invalid`);
        }

        if (!ok) {
            return [ok, err];
        }
    }

    return [true];
}

/**
 * 根据规则表检查字典并进行断言
 *
 * @param dict
 * @param rules
 * @param message
 */
export function assertDictionary(
    dict: any,
    rules: CheckRules,
    message?: string
): asserts dict {
    const [ok, err] = checkDictionary(dict, rules);
    if (!ok) {
        throw new TypeError(
            message ?? `assertDictionary(): assert failed, ${err}`
        );
    }
}

/**
 * 根据指定的类型检查函数将 object 转换为字典
 *
 * @param source
 * @param typeGuard
 * @param creator
 */
export function createDictionary<T>(
    source: any,
    typeGuard: Function,
    creator?: Function
): Map<string, T> {
    if (typeof source !== "object") {
        throw new TypeError("createDictionary(): source is not object");
    }

    const dict = new Map<string, T>();
    for (const key in source) {
        const v = source[key];
        if (!typeGuard(v)) {
            throw new TypeError(
                `createDictionary(): source[${key}] type mismatch`
            );
        }
        if (creator) {
            dict.set(key, creator(v));
        } else {
            dict.set(key, { ...v });
        }
    }
    return dict;
}

//// private

interface CheckTypeFunction {
    (val: any): boolean;
}

interface NumericEnum {
    [key: string]: number;
}

interface StringEnum {
    [key: string]: string;
}

interface CheckTypeStruct {
    type: string;
    check: CheckTypeFunction | NumericEnum | StringEnum;
}

function isCheckTypeStruct(o: any): o is CheckTypeStruct {
    if (typeof o !== "object") return false;
    if (typeof o["type"] !== "string") return false;
    const ct = typeof o["check"];
    if (ct !== "function" && ct != "object") return false;
    return true;
}

type CheckRule =
    | string
    | CheckTypeFunction
    | NumericEnum
    | StringEnum
    | CheckTypeStruct;

interface CheckRules {
    [key: string]: CheckRule;
}

/**
 * 分离容器类型和元素类型
 *
 * 容器类型必须是 `容器类型<元素类型>` 的表示形式。
 *
 * @param type
 * @returns 如果并非容器类型返回 [false]，否则返回 [true, 容器类型,　元素类型]
 */
function fetchContainerType(type: string): [boolean, string?, string?] {
    const p1 = type.indexOf("<");
    if (p1 === -1) {
        return [false];
    } else {
        const p2 = type.indexOf(">");
        return [true, type.substr(0, p1), type.substring(p1 + 1, p2)];
    }
}
