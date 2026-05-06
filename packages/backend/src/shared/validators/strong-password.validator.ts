import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { isWeakPassword } from '@a-idol/shared';

export function IsStrongPassword(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && !isWeakPassword(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property}는 흔한 패턴이거나 추측되기 쉽습니다. 13자 이상 passphrase 또는 더 고유한 조합을 사용해 주세요.`;
        },
      },
    });
  };
}
