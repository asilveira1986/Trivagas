"use client";

import { startTransition, type FormEvent } from "react";

// No React 19, <form action={...}> limpa os campos ao fim da ação; em formulários longos isso
// apaga o que a pessoa digitou quando há erro de validação. Este envio chama a ação sem o reset.
export function usePreservingSubmit(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  };
}
