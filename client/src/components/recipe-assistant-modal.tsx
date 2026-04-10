import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Check, ChevronDown, ChevronUp, ExternalLink, Loader2, Clock, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { jsonApiRequest } from "@/lib/queryClient";

interface SuggestedRecipe {
  catalogIndex: number;
  nombre: string;
  descripcion: string;
  imagen: string;
  enlaceExterno: string;
  categoria: string;
  ingredientes: string[];
  instrucciones: string;
  tiempoPreparacion: number | null;
  porciones: number | null;
  tags: string[];
  dieta: string | null;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SuggestResponse {
  message: string;
  recipes: SuggestedRecipe[];
  conversationHistory: ConversationMessage[];
}

interface PopulateResponse {
  message: string;
  count: number;
}

interface RecipeAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'chat' | 'review' | 'done';

function RecipePreviewCard({ recipe, expanded, selected, onToggle, onSelect }: {
  recipe: SuggestedRecipe;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: (checked: boolean) => void;
}) {
  return (
    <Card className={`overflow-hidden transition-colors ${
      selected ? 'border-green-300 bg-green-50/30' : 'border-gray-200'
    }`}>
      <div className="p-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(checked === true)}
            className="mt-1 flex-shrink-0 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          />
          {recipe.imagen && recipe.imagen.startsWith('http') && (
            <img
              src={recipe.imagen}
              alt={recipe.nombre}
              className="w-14 h-14 rounded-lg object-cover flex-shrink-0 cursor-pointer"
              onClick={onToggle}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
            <h4 className="font-medium text-sm text-gray-900 leading-tight">{recipe.nombre}</h4>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">{recipe.categoria}</Badge>
              {recipe.dieta && (
                <Badge variant="outline" className="text-xs text-green-700 border-green-300">{recipe.dieta}</Badge>
              )}
              {recipe.tiempoPreparacion && (
                <span className="text-xs text-gray-500 flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {recipe.tiempoPreparacion} min
                </span>
              )}
              {recipe.porciones && (
                <span className="text-xs text-gray-500 flex items-center gap-0.5">
                  <Users className="w-3 h-3" />
                  {recipe.porciones}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="p-1 h-auto flex-shrink-0" onClick={onToggle}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-2">
          {recipe.descripcion && (
            <p className="text-xs text-gray-600">{recipe.descripcion}</p>
          )}
          {recipe.ingredientes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Ingredientes:</p>
              <p className="text-xs text-gray-600">
                {recipe.ingredientes.join(' · ')}
              </p>
            </div>
          )}
          {recipe.enlaceExterno && (
            <a
              href={recipe.enlaceExterno}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              Ver receta completa en Foodit <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

export function RecipeAssistantModal({ isOpen, onClose }: RecipeAssistantModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [recipes, setRecipes] = useState<SuggestedRecipe[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [expandedRecipe, setExpandedRecipe] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [populatedCount, setPopulatedCount] = useState(0);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('chat');
      setInput('');
      setMessages([]);
      setRecipes([]);
      setConversationHistory([]);
      setExpandedRecipe(null);
      setSelectedIndices(new Set());
      setPopulatedCount(0);
    }
  }, [isOpen]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, recipes]);

  const suggestMutation = useMutation({
    mutationFn: async (preferences: string): Promise<SuggestResponse> => {
      return await jsonApiRequest<SuggestResponse>('/api/recipes/suggest', {
        method: 'POST',
        body: JSON.stringify({ preferences }),
      });
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', text: data.message }]);
      setConversationHistory(data.conversationHistory);
      if (data.recipes.length > 0) {
        setRecipes(data.recipes);
        setSelectedIndices(new Set(data.recipes.map(r => r.catalogIndex)));
        setStep('review');
      }
    },
    onError: (error: any) => {
      const errorMsg = error.message?.includes('503')
        ? 'El servicio de IA no está disponible en este momento. Verificá que la API key esté configurada.'
        : 'Hubo un error al generar las sugerencias. Intentá de nuevo.';
      setMessages(prev => [...prev, { role: 'assistant', text: errorMsg }]);
    },
  });

  const refineMutation = useMutation({
    mutationFn: async (feedback: string): Promise<SuggestResponse> => {
      return await jsonApiRequest<SuggestResponse>('/api/recipes/suggest/refine', {
        method: 'POST',
        body: JSON.stringify({ feedback, conversationHistory }),
      });
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', text: data.message }]);
      setConversationHistory(data.conversationHistory);
      if (data.recipes.length > 0) {
        setRecipes(data.recipes);
        setSelectedIndices(new Set(data.recipes.map(r => r.catalogIndex)));
      }
    },
    onError: () => {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Hubo un error al ajustar las sugerencias.' }]);
    },
  });

  const populateMutation = useMutation({
    mutationFn: async (): Promise<PopulateResponse> => {
      const catalogIndices = [...selectedIndices];
      return await jsonApiRequest<PopulateResponse>('/api/recipes/populate', {
        method: 'POST',
        body: JSON.stringify({ catalogIndices }),
      });
    },
    onSuccess: (data) => {
      setPopulatedCount(data.count);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: "¡Recetas agregadas!",
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudieron agregar las recetas. Intentá de nuevo.",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');

    if (step === 'chat') {
      suggestMutation.mutate(text);
    } else {
      refineMutation.mutate(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isLoading = suggestMutation.isPending || refineMutation.isPending;

  // Track visual viewport height for mobile keyboard handling
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setViewportHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    return () => vv.removeEventListener('resize', update);
  }, [isOpen]);

  if (!isOpen) return null;

  const heightStyle = viewportHeight
    ? { height: `${viewportHeight}px`, top: 0 }
    : { top: 0, bottom: 0 };

  return (
    <div
      className="fixed left-0 right-0 z-[60] bg-white flex flex-col"
      style={heightStyle}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-base">
            {step === 'done' ? '¡Listo!' : 'Armá tu menú con IA'}
          </h2>
        </div>
        <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      {step === 'done' ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold">¡Recetas agregadas!</h3>
          <p className="text-gray-600 text-sm">
            Se agregaron {populatedCount} recetas a tu biblioteca. Ya podés empezar a planificar tu semana.
          </p>
          <Button onClick={onClose} className="mt-2">
            Ir a mis recetas
          </Button>
        </div>
      ) : (
        <>
          {/* Main content area */}
          <div className="flex-1 flex flex-col min-h-0">

            {/* Empty state — centered with suggestions */}
            {messages.length === 0 && step === 'chat' ? (
              <div className="flex-1 flex flex-col items-center justify-end px-5 pb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-sm text-gray-500 text-center mb-4">
                  Contame qué les gusta comer y te armo una lista de recetas
                </p>
                {/* Suggestion chips */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    'Comida saludable para la semana',
                    'Postres con chocolate',
                    'Sugerí 5 platos con pollo',
                    'Recetas vegetarianas fáciles para chicos',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        // Auto-send after a tick so the user sees it
                        setTimeout(() => {
                          setMessages(prev => [...prev, { role: 'user', text: suggestion }]);
                          setInput('');
                          suggestMutation.mutate(suggestion);
                        }, 0);
                      }}
                      disabled={isLoading}
                      className="text-xs px-3 py-2 rounded-full border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 active:bg-amber-200 transition-colors text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Chat messages + recipe list — scrollable */
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 min-h-0">
                <div className="space-y-3 py-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        <span className="text-sm text-gray-400">Pensando...</span>
                      </div>
                    </div>
                  )}

                  {/* Recipe list in review mode */}
                  {step === 'review' && recipes.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                          {selectedIndices.size} de {recipes.length} seleccionadas
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-auto py-1 px-2"
                          onClick={() => {
                            if (selectedIndices.size === recipes.length) {
                              setSelectedIndices(new Set());
                            } else {
                              setSelectedIndices(new Set(recipes.map(r => r.catalogIndex)));
                            }
                          }}
                        >
                          {selectedIndices.size === recipes.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                        </Button>
                      </div>
                      {recipes.map((recipe, i) => (
                        <RecipePreviewCard
                          key={recipe.catalogIndex}
                          recipe={recipe}
                          expanded={expandedRecipe === i}
                          selected={selectedIndices.has(recipe.catalogIndex)}
                          onToggle={() => setExpandedRecipe(expandedRecipe === i ? null : i)}
                          onSelect={(checked) => {
                            setSelectedIndices(prev => {
                              const next = new Set(prev);
                              if (checked) {
                                next.add(recipe.catalogIndex);
                              } else {
                                next.delete(recipe.catalogIndex);
                              }
                              return next;
                            });
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <div ref={scrollEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Approve button in review mode */}
          {step === 'review' && recipes.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 flex-shrink-0">
              <Button
                onClick={() => populateMutation.mutate()}
                disabled={populateMutation.isPending || selectedIndices.size === 0}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {populateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Agregando recetas...</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Agregar {selectedIndices.size} receta{selectedIndices.size !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          )}

          {/* Input area — always at bottom */}
          <div className="px-4 pt-2 pb-5 border-t border-gray-200 flex-shrink-0 bg-white" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))' }}>
            <div className="flex gap-2 items-end">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={step === 'review'
                  ? "Pedí cambios..."
                  : "Describí lo que les gusta comer..."
                }
                className="min-h-[44px] max-h-[88px] resize-none text-base rounded-2xl"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-[44px] w-[44px] rounded-full flex-shrink-0 bg-amber-500 hover:bg-amber-600"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
