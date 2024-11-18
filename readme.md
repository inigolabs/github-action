# Inigo Github action

This action performs Inigo schema check and apply operations. It requires authentication, for a documentation of configuring it, please visit [docs.inigo.io](https://docs.inigo.io/reference/cli/github_action).

# Usage

<!-- start usage -->
```yaml
- uses: inigolabs/github-action@main
  with:
    # Required. Inigo username.
    username: ${{ secrets.INIGO_USERNAME }}

    # Required. Inigo password.
    password: ${{ secrets.INIGO_PASSWORD }}

    # Required. Relative path under $GITHUB_WORKSPACE to read Inigo configuration files.
    path: ''

    # Optional. Inigo service label.
    # Default: ''
    label: ''

    # Optional. Action to perform: "check" for CI, "apply" for CD.
    # Default: 'check'
    action: ''
```
<!-- end usage -->

## CI Integration
```yaml
      - name: Inigo GraphQL
        uses: inigolabs/github-action@main
        with:
          username: ${{ secrets.INIGO_USERNAME }}
          password: ${{ secrets.INIGO_PASSWORD }}
          path: configs/*.yml
```

## CD Integration
```yaml
      - name: Inigo GraphQL
        uses: inigolabs/github-action@main
        with:
          username: ${{ secrets.INIGO_USERNAME }}
          password: ${{ secrets.INIGO_PASSWORD }}
          path: configs/*.yml
          action: 'apply'
```

## Different Inigo services

Inigo uses service labels to distinguish environments. To share Inigo configuration between environments, it's allowed to use same yaml files and specify the label during execution.

```yaml
      - name: Inigo GraphQL
        uses: inigolabs/github-action@main
        with:
          username: ${{ secrets.INIGO_USERNAME }}
          password: ${{ secrets.INIGO_PASSWORD }}
          path: configs/*.yml
          label: ${{ env.IS_STAGING && 'staging' || 'production' }}
```
