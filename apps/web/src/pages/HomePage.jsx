
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Trophy, DollarSign, Users, MoreVertical, TrendingUp, Sparkles, ShieldCheck, Medal, Copy, CheckCircle2, MessageCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import ScoreSelectorComponent from '@/components/ScoreSelectorComponent.jsx';

const HomePage = () => {
  const [apostas, setApostas] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestingDeletionId, setRequestingDeletionId] = useState(null);
  const [duplicateConfirmation, setDuplicateConfirmation] = useState(null);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: ''
  });
  const [brasilScore, setBrasilScore] = useState('');
  const [marrocosScore, setMarrocosScore] = useState('');
  const pixKey = '60.502.717/0001-63';

  const copyPixKey = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
      setPixCopied(true);
      toast.success('Chave PIX copiada');
    } catch (error) {
      console.error('Unable to copy PIX key:', error);
      toast.error('Não foi possível copiar. Selecione a chave manualmente.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [apostasData, configData] = await Promise.all([
        pb.collection('apostas').getFullList({ sort: 'created', $autoCancel: false }),
        pb.collection('configuracao_bolao').getFullList({ $autoCancel: false })
      ]);
      setApostas(apostasData);
      setConfig(configData[0] || null);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);

    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      setSubmitting(false);
      return;
    }

    if (brasilScore === '' || marrocosScore === '') {
      toast.error('Preencha o placar completo');
      setSubmitting(false);
      return;
    }

    const placarFormatado = `${brasilScore} x ${marrocosScore}`;

    const normalizedName = formData.nome.trim().toLowerCase();
    const normalizedPhone = formData.telefone.trim();
    const existingBets = apostas.filter((aposta) =>
      aposta.nome.trim().toLowerCase() === normalizedName ||
      (normalizedPhone && aposta.telefone === normalizedPhone)
    );

    if (existingBets.length > 0) {
      const repeatsScore = existingBets.some((aposta) => aposta.placar === placarFormatado);
      setDuplicateConfirmation({
        placar: placarFormatado,
        total: existingBets.length,
        repeatsScore
      });
      setSubmitting(false);
      return;
    }

    try {
      await pb.collection('apostas').create({
        nome: formData.nome,
        telefone: formData.telefone,
        placar: placarFormatado,
        status: 'pendente',
        valor: 10
      }, { $autoCancel: false });

      try {
        await pb.collection('logs').create({
          acao: 'cadastro',
          descricao: `Nova aposta cadastrada: ${formData.nome} - ${placarFormatado}`
        }, { $autoCancel: false });
      } catch (logError) {
        console.info('Bet created without public log access:', logError);
      }

      toast.success('Aposta registrada com sucesso');
      setFormData({ nome: '', telefone: '' });
      setBrasilScore('');
      setMarrocosScore('');
      setPixCopied(false);
      setPixModalOpen(true);
      fetchData();
    } catch (error) {
      console.error('Error creating bet:', error);
      toast.error('Erro ao registrar aposta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = async (aposta) => {
    if (requestingDeletionId) return;
    setRequestingDeletionId(aposta.id);

    try {
      await pb.collection('solicitacoes_exclusao').create({
        aposta_id: aposta.id,
        nome: aposta.nome
      }, { $autoCancel: false });

      try {
        await pb.collection('logs').create({
          acao: 'solicitacao_exclusao',
          descricao: `Solicitação de exclusão: ${aposta.nome}`
        }, { $autoCancel: false });
      } catch (logError) {
        console.info('Deletion request created without public log access:', logError);
      }

      toast.success('Solicitação de exclusão enviada para o administrador');
    } catch (error) {
      console.error('Error creating deletion request:', error);
      toast.error('Erro ao registrar solicitação');
    } finally {
      setRequestingDeletionId(null);
    }
  };

  const totalAccumulated = apostas.reduce((sum, aposta) => {
    return sum + (aposta.valor || 10);
  }, 0);

  const groupedScores = apostas.reduce((acc, aposta) => {
    const score = aposta.placar;
    if (!acc[score]) {
      acc[score] = { score, count: 0, people: [] };
    }
    acc[score].count++;
    acc[score].people.push(aposta.nome);
    return acc;
  }, {});

  const groupedArray = Object.values(groupedScores).sort((a, b) => b.count - a.count);

  const chartData = groupedArray.slice(0, 5).map(item => ({
    name: item.score,
    value: item.count
  }));

  const COLORS = ['hsl(var(--brasil-green))', 'hsl(var(--brasil-yellow))', 'hsl(var(--brasil-blue))', '#FF6F00', '#7B1FA2'];

  const getWinnerDisplay = () => {
    if (!config || !config.placar_final) {
      return 'Vencedor: ainda a definir';
    }

    if (!config.vencedores || config.vencedores.length === 0) {
      return 'Nenhum vencedor';
    }

    return `Vencedor(es): ${config.vencedores.join(', ')}`;
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Bolão Brasil x Marrocos</title>
        <meta name="description" content="Participe do Bolão Brasil x Marrocos e concorra a prêmios incríveis apostando no placar do jogo" />
      </Helmet>
      <Header />
      <main className="app-shell min-h-screen">
        <section 
          className="relative isolate overflow-hidden bg-cover bg-center py-20 md:py-28"
          style={{
            backgroundImage: 'url(/og-image.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--brasil-green))]/95 via-[hsl(var(--brasil-green))]/88 to-[hsl(var(--brasil-blue))]/82"></div>
          <div className="absolute -left-24 top-1/2 h-72 w-72 rounded-full bg-secondary/25 blur-3xl"></div>
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border-[70px] border-white/5"></div>
          <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-secondary backdrop-blur-md">
              <Sparkles className="h-4 w-4" /> O grande jogo está chegando
            </div>
            <h1 className="mx-auto mb-6 max-w-4xl text-4xl font-extrabold text-white md:text-6xl">
              Acerte o placar.<br /><span className="text-secondary">Viva a emoção.</span>
            </h1>
            <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-2xl border border-white/20 bg-black/20 p-2 shadow-2xl backdrop-blur-xl sm:gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-white/12 px-4 py-2.5 sm:px-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[10px] font-black text-secondary-foreground">BR</span>
                <span className="font-[Manrope] text-base font-extrabold text-white sm:text-lg">Brasil</span>
              </div>
              <span className="font-[Manrope] text-xs font-black uppercase tracking-[0.16em] text-secondary">X</span>
              <div className="flex items-center gap-2 rounded-xl bg-white/12 px-4 py-2.5 sm:px-5">
                <span className="font-[Manrope] text-base font-extrabold text-white sm:text-lg">Marrocos</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">MA</span>
              </div>
            </div>
            <p className="mx-auto mb-9 max-w-2xl text-lg leading-relaxed text-white/75 md:text-xl">
              Dê seu palpite e participe do bolão mais animado da torcida.
            </p>
            <div className="inline-flex items-center gap-4 rounded-2xl border border-white/20 bg-white/12 px-5 py-3 text-white shadow-2xl backdrop-blur-xl sm:px-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><DollarSign className="h-5 w-5" /></div>
              <div className="text-left">
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Valor da aposta</span>
                <span className="font-[Manrope] text-2xl font-extrabold">R$ 10,00</span>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="relative z-10 -mt-20 mb-14 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Card className="glass-card overflow-hidden border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><TrendingUp className="h-5 w-5 text-primary" /></span>
                  Valor do Bolão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-[Manrope] text-4xl font-extrabold text-primary">R$ {totalAccumulated.toFixed(2)}</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> {apostas.length} apostas registradas</p>
              </CardContent>
            </Card>

            <Card className="glass-card overflow-hidden border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/25"><Trophy className="h-5 w-5 text-foreground" /></span>
                  Vencedor do Bolão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{getWinnerDisplay()}</p>
                {config && config.placar_final && (
                  <p className="text-sm text-muted-foreground mt-2">Placar final: {config.placar_final}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mb-12 border-primary/10">
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div className="space-y-3">
                <span className="section-kicker w-fit"><Medal className="h-3.5 w-3.5" /> Faça parte</span>
                <div>
                  <CardTitle className="text-2xl">Registrar Nova Aposta</CardTitle>
                  <CardDescription className="mt-2">Preencha seus dados e o palpite para Brasil x Marrocos</CardDescription>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-secondary/50 bg-secondary/15 px-4 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <DollarSign className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Valor da aposta</p>
                  <p className="font-[Manrope] text-xl font-extrabold text-foreground">R$ 10,00</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input
                      id="nome"
                      type="text"
                      placeholder="Seu nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                      className="text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone <span className="text-muted-foreground">(opcional)</span></Label>
                    <Input
                      id="telefone"
                      type="text"
                      placeholder="(XX) XXXXX-XXXX"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      className="text-foreground"
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="block font-[Manrope] text-base font-extrabold">Seu palpite</Label>
                  <ScoreSelectorComponent 
                    brasilScore={brasilScore}
                    marrocosScore={marrocosScore}
                    onBrasilChange={setBrasilScore}
                    onMarrocosChange={setMarrocosScore}
                    onSubmit={handleSubmit}
                    disabled={submitting}
                  />
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="mb-12 overflow-hidden border-primary/15 bg-primary/[0.035]">
            <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
                  <Copy className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">PIX copia e cola</p>
                  <p className="mt-1 break-all font-[Manrope] text-xl font-extrabold text-foreground">{pixKey}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Pague R$ 10,00 e envie o comprovante pelo WhatsApp da Mari.</p>
                </div>
              </div>
              <Button type="button" onClick={copyPixKey} className="w-full shrink-0 sm:w-auto">
                {pixCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {pixCopied ? 'Chave copiada' : 'Copiar chave PIX'}
              </Button>
            </CardContent>
          </Card>

          <Card className="mb-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Todas as Apostas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {apostas.map((aposta) => (
                  <div key={aposta.id} className="soft-panel flex flex-col gap-3 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{aposta.nome}</p>
                      <p className="text-sm font-medium text-[hsl(var(--brasil-blue))]">Brasil {aposta.placar.split('x')[0].trim()} x {aposta.placar.split('x')[1]?.trim()} Marrocos</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={aposta.status === 'pago' ? 'default' : 'secondary'} className={aposta.status === 'pago' ? 'bg-success text-success-foreground hover:bg-success/90' : 'border border-amber-300/70 bg-amber-100 text-amber-800 hover:bg-amber-200'}>
                        {aposta.status}
                      </Badge>
                      <span className="font-semibold text-primary">R$ {(aposta.valor || 10).toFixed(2)}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            disabled={requestingDeletionId === aposta.id}
                            onSelect={() => handleDeleteRequest(aposta)}
                            className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive data-[disabled]:cursor-not-allowed"
                          >
                            {requestingDeletionId === aposta.id ? 'Enviando...' : 'Solicitar exclusão'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                {apostas.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">Nenhuma aposta registrada ainda.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
            <Card>
              <CardHeader>
                <CardTitle>Apostas Agrupadas</CardTitle>
                <CardDescription>Placares mais apostados e prêmio por pessoa</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {groupedArray.map((item, index) => (
                    <div key={index} className="soft-panel p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-[hsl(var(--brasil-blue))]">Brasil {item.score.split('x')[0].trim()} x {item.score.split('x')[1]?.trim()} Marrocos</p>
                        <Badge>{item.count} {item.count === 1 ? 'pessoa' : 'pessoas'}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Prêmio por pessoa: R$ {(totalAccumulated / item.count).toFixed(2)}
                      </p>
                    </div>
                  ))}
                  {groupedArray.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">Sem dados para exibir.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Placares Mais Apostados</CardTitle>
                <CardDescription>Top 5 palpites</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, `Brasil ${name.split('x')[0].trim()} x ${name.split('x')[1]?.trim()} Marrocos`]} />
                      <Legend formatter={(value) => `Brasil ${value.split('x')[0].trim()} x ${value.split('x')[1]?.trim()} Marrocos`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center">
                    <p className="text-muted-foreground">Sem dados para exibir.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Dialog open={Boolean(duplicateConfirmation)} onOpenChange={(open) => !open && setDuplicateConfirmation(null)}>
        <DialogContent className="max-w-md rounded-2xl border-white/70 p-7">
          <DialogHeader className="text-left">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/25 text-xl font-extrabold text-foreground">
              +1
            </div>
            <DialogTitle className="text-xl">Registrar mais uma cota?</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              <strong className="text-foreground">{formData.nome.trim()}</strong> já possui{' '}
              <strong className="text-foreground">{duplicateConfirmation?.total} {duplicateConfirmation?.total === 1 ? 'cota cadastrada' : 'cotas cadastradas'}</strong>.
              {duplicateConfirmation?.repeatsScore && ' Este mesmo placar também já foi escolhido.'}
              {' '}Deseja registrar outra cota por R$ 10,00?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-3 gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setDuplicateConfirmation(null)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                const placar = duplicateConfirmation.placar;
                setDuplicateConfirmation(null);
                setSubmitting(true);

                try {
                  await pb.collection('apostas').create({
                    nome: formData.nome,
                    telefone: formData.telefone,
                    placar,
                    status: 'pendente',
                    valor: 10
                  }, { $autoCancel: false });

                  toast.success('Nova cota registrada com sucesso');
                  setFormData({ nome: '', telefone: '' });
                  setBrasilScore('');
                  setMarrocosScore('');
                  setPixCopied(false);
                  setPixModalOpen(true);
                  fetchData();
                } catch (error) {
                  console.error('Error creating additional bet:', error);
                  toast.error('Erro ao registrar nova cota');
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
            >
              {submitting ? 'Registrando...' : 'Sim, registrar cota'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={pixModalOpen} onOpenChange={setPixModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border-white/70 p-7">
          <DialogHeader className="text-left">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl">Aposta registrada!</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              Faça o pagamento de <strong className="text-foreground">R$ 10,00</strong> utilizando a chave PIX abaixo para confirmar sua aposta.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Chave PIX</p>
            <p className="break-all font-[Manrope] text-lg font-extrabold text-foreground">{pixKey}</p>
          </div>
          <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="font-[Manrope] text-sm font-extrabold">Envie o comprovante para a Mari</p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                Após realizar o PIX, envie o comprovante pelo WhatsApp da Mari para confirmar o pagamento da aposta.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-2 gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setPixModalOpen(false)}>Fechar</Button>
            <Button
              onClick={copyPixKey}
            >
              {pixCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {pixCopied ? 'Chave copiada' : 'Copiar chave PIX'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Footer />
    </>
  );
};

export default HomePage;
