# @pascal-app/i18n

Shared, instance-scoped internationalization for Pascal UI packages.

- English and Simplified Chinese resources are bundled synchronously.
- Hosts own their i18n instance and pass it through `PascalI18nProvider`.
- Components rendered without a provider use a read-only English fallback instance.
- Plugins can register isolated translation namespaces per instance.
