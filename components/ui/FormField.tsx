import * as React from "react";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label: string;
  name: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  type?: string;
  className?: string;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, name, placeholder, helperText, required, type = "text", className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-2 mb-4", className)} {...props}>
        <label 
          htmlFor={name} 
          className="block text-sm font-medium"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {helperText && (
          <p className="text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export { FormField };
